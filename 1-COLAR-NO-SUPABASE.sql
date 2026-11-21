-- =====================================================================
-- Bemdi / Espaço Pede Fácil — Multi-tenant + RBAC (Supabase / PostgreSQL)
-- Tabelas: companies, users, store_members, invitations, orders
-- Toda leitura/escrita é isolada por company_id via RLS.
-- =====================================================================
begin;

-- ---------- ENUMS ----------------------------------------------------
create type public.member_role       as enum ('owner', 'manager', 'staff');
create type public.member_status     as enum ('pending', 'active', 'rejected', 'suspended');
create type public.staff_function    as enum ('waiter', 'courier', 'kitchen');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
create type public.order_status      as enum ('new', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled');

-- ---------- TABELAS --------------------------------------------------
create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 2 and 120),
  slug       text not null unique check (slug ~ '^[a-z0-9-]{3,50}$'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- Perfil público do usuário (espelha auth.users)
create table public.users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Vínculo usuário <-> empresa (é daqui que sai o role)
create table public.store_members (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  role           public.member_role not null,
  staff_function public.staff_function,
  status         public.member_status not null default 'pending',
  invitation_id  uuid,
  invited_by     uuid references auth.users (id),
  approved_by    uuid references auth.users (id),
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (company_id, user_id),
  check (role = 'staff' or staff_function is null)
);
create unique index store_members_one_owner on public.store_members (company_id) where role = 'owner';
create index store_members_user_idx on public.store_members (user_id, status);

create table public.invitations (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  email          text not null check (email = lower(email)),
  role           public.member_role not null check (role in ('manager', 'staff')),
  staff_function public.staff_function,
  token          text not null unique
                 default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status         public.invitation_status not null default 'pending',
  invited_by     uuid not null default auth.uid() references auth.users (id),
  expires_at     timestamptz not null default now() + interval '7 days',
  accepted_by    uuid references auth.users (id),
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  check (role = 'staff' or staff_function is null)
);
create unique index invitations_one_pending on public.invitations (company_id, email) where status = 'pending';

create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies (id) on delete cascade,
  assigned_to      uuid references auth.users (id),
  kind             text not null default 'dine_in' check (kind in ('dine_in', 'delivery', 'pickup')),
  status           public.order_status not null default 'new',
  table_number     int,
  customer_name    text,
  customer_phone   text,
  delivery_address text,
  items            jsonb not null default '[]'::jsonb,
  total_cents      int not null default 0 check (total_cents >= 0),
  notes            text,
  created_by       uuid default auth.uid() references auth.users (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_company_status_idx on public.orders (company_id, status, created_at desc);
create index orders_company_assigned_idx on public.orders (company_id, assigned_to);

-- ---------- PERFIL AUTOMÁTICO ---------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (new.id, lower(new.email),
          coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
          new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- FUNÇÕES AUXILIARES DE RLS (security definer: sem recursão) --
create function public.member_role_in(p_company uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.store_members m
  where m.company_id = p_company and m.user_id = (select auth.uid()) and m.status = 'active'
  limit 1
$$;

create function public.is_admin_of(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.member_role_in(p_company) in ('owner', 'manager'), false)
$$;

create function public.is_owner_of(p_company uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.member_role_in(p_company) = 'owner', false)
$$;

create function public.shares_company_as_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.store_members me
    join public.store_members o on o.company_id = me.company_id
    where me.user_id = (select auth.uid()) and me.status = 'active'
      and me.role in ('owner', 'manager') and o.user_id = p_user)
$$;

-- ---------- TRIGGERS DE PROTEÇÃO ------------------------------------
create function public.members_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.company_id <> old.company_id or new.user_id <> old.user_id
     or new.invitation_id is distinct from old.invitation_id then
    raise exception 'immutable_columns';
  end if;
  if new.status = 'active' and old.status <> 'active' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end $$;
create trigger store_members_guard before update on public.store_members
  for each row execute function public.members_guard();

create function public.orders_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_role public.member_role; v_fn public.staff_function;
begin
  -- o responsável precisa ser membro ativo da MESMA empresa
  if new.assigned_to is not null and not exists (
       select 1 from public.store_members m
       where m.company_id = new.company_id and m.user_id = new.assigned_to and m.status = 'active') then
    raise exception 'assignee_not_in_company';
  end if;
  v_role := public.member_role_in(new.company_id);

  if tg_op = 'INSERT' then
    if v_role = 'staff' and new.status <> 'new' then raise exception 'staff_must_create_as_new'; end if;
  else
    if new.company_id <> old.company_id then raise exception 'company_immutable'; end if;
    if v_role = 'staff' then
      -- staff só muda o status...
      if (to_jsonb(new) - 'status' - 'updated_at') is distinct from (to_jsonb(old) - 'status' - 'updated_at') then
        raise exception 'staff_can_only_change_status';
      end if;
      -- ...e só pelas transições da sua função (não cancela, não volta etapa)
      if new.status is distinct from old.status then
        select m.staff_function into v_fn from public.store_members m
         where m.company_id = new.company_id and m.user_id = auth.uid() and m.status = 'active';
        if not coalesce(
             (v_fn = 'kitchen' and ((old.status = 'new' and new.status = 'preparing')
                                 or (old.status = 'preparing' and new.status = 'ready')))
          or (v_fn = 'waiter'  and old.status = 'ready' and new.status = 'delivered')
          or (v_fn = 'courier' and ((old.status = 'ready' and new.status = 'out_for_delivery')
                                 or (old.status = 'out_for_delivery' and new.status = 'delivered'))), false) then
          raise exception 'invalid_status_transition';
        end if;
      end if;
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
create trigger orders_guard before insert or update on public.orders
  for each row execute function public.orders_guard();

-- ---------- RLS ------------------------------------------------------
alter table public.companies     enable row level security;
alter table public.users         enable row level security;
alter table public.store_members enable row level security;
alter table public.invitations   enable row level security;
alter table public.orders        enable row level security;

-- companies (criação só pela RPC create_company)
create policy companies_select on public.companies for select to authenticated
  using (public.member_role_in(id) is not null);
create policy companies_update on public.companies for update to authenticated
  using (public.is_owner_of(id)) with check (public.is_owner_of(id));
create policy companies_delete on public.companies for delete to authenticated
  using (public.is_owner_of(id));

-- users
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.shares_company_as_admin(id));
create policy users_update on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- store_members (INSERT só via RPC accept_invitation / create_company)
create policy members_select on public.store_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin_of(company_id));
create policy members_update_owner on public.store_members for update to authenticated
  using (public.is_owner_of(company_id) and role <> 'owner' and user_id <> (select auth.uid()))
  with check (public.is_owner_of(company_id) and role <> 'owner');
create policy members_update_manager on public.store_members for update to authenticated
  using (public.member_role_in(company_id) = 'manager' and role = 'staff')
  with check (role = 'staff');
create policy members_delete_owner on public.store_members for delete to authenticated
  using (public.is_owner_of(company_id) and role <> 'owner');
create policy members_delete_manager on public.store_members for delete to authenticated
  using (public.member_role_in(company_id) = 'manager' and role = 'staff');

-- invitations: owner convida manager/staff; manager convida só staff
create policy invitations_select on public.invitations for select to authenticated
  using (public.is_admin_of(company_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (invited_by = (select auth.uid()) and (
      public.is_owner_of(company_id)
      or (public.member_role_in(company_id) = 'manager' and role = 'staff')));
create policy invitations_revoke on public.invitations for update to authenticated
  using (public.is_owner_of(company_id) or (public.member_role_in(company_id) = 'manager' and role = 'staff'))
  with check (status = 'revoked');

-- orders: admin vê tudo da empresa; staff só os atribuídos a ele
create policy orders_select on public.orders for select to authenticated using (
  public.is_admin_of(company_id)
  or (public.member_role_in(company_id) = 'staff' and assigned_to = (select auth.uid())));
create policy orders_insert on public.orders for insert to authenticated with check (
  public.is_admin_of(company_id)
  or (public.member_role_in(company_id) = 'staff'
      and assigned_to = (select auth.uid()) and created_by = (select auth.uid())));
create policy orders_update on public.orders for update to authenticated
  using (public.is_admin_of(company_id)
         or (public.member_role_in(company_id) = 'staff' and assigned_to = (select auth.uid())))
  with check (public.is_admin_of(company_id)
         or (public.member_role_in(company_id) = 'staff' and assigned_to = (select auth.uid())));
create policy orders_delete on public.orders for delete to authenticated
  using (public.is_admin_of(company_id));

-- ---------- PRIVILÉGIOS (defesa em profundidade) --------------------
revoke all on all tables in schema public from anon;
revoke insert on public.store_members from authenticated;
revoke update on public.users from authenticated;
grant  update (full_name, avatar_url) on public.users to authenticated;
revoke update on public.invitations from authenticated;
grant  update (status) on public.invitations to authenticated;

-- ---------- RPCs -----------------------------------------------------
-- Empresário cria a empresa e vira owner ativo
create function public.create_company(p_name text, p_slug text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into public.companies (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), auth.uid()) returning id into v_id;
  insert into public.store_members (company_id, user_id, role, status, approved_by, approved_at)
  values (v_id, auth.uid(), 'owner', 'active', auth.uid(), now());
  return v_id;
end $$;

-- Prévia do convite pelo token (único dado acessível sem login)
create function public.get_invitation_preview(p_token text)
returns table (company_name text, role public.member_role, staff_function public.staff_function,
               email text, expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.name, i.role, i.staff_function, i.email, i.expires_at
  from public.invitations i join public.companies c on c.id = i.company_id
  where i.token = p_token and i.status = 'pending' and i.expires_at > now()
$$;

-- Convidado aceita: cria o vínculo PENDENTE (sem acesso até o owner aprovar)
create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_inv public.invitations; v_email text; v_confirmed timestamptz; v_member uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select lower(email), email_confirmed_at into v_email, v_confirmed from auth.users where id = auth.uid();
  if v_confirmed is null then raise exception 'email_not_confirmed'; end if;

  select * into v_inv from public.invitations where token = p_token for update;
  if not found or v_inv.status <> 'pending' or v_inv.expires_at < now() then
    raise exception 'invalid_invitation';
  end if;
  if v_email <> v_inv.email then raise exception 'email_mismatch'; end if;

  -- já existe vínculo (ativo, pendente, rejeitado ou suspenso): NÃO consome o convite
  if exists (select 1 from public.store_members
             where company_id = v_inv.company_id and user_id = auth.uid()) then
    raise exception 'already_member';
  end if;

  insert into public.store_members (company_id, user_id, role, staff_function, status, invitation_id, invited_by)
  values (v_inv.company_id, auth.uid(), v_inv.role, v_inv.staff_function, 'pending', v_inv.id, v_inv.invited_by)
  returning id into v_member;

  update public.invitations
     set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
   where id = v_inv.id;
  return v_member;
end $$;

-- Aprovar / rejeitar: owner aprova qualquer um; manager só staff
create function public.approve_member(p_member_id uuid, p_approve boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare m public.store_members; v_caller public.member_role;
begin
  select * into m from public.store_members where id = p_member_id for update;
  if not found then raise exception 'not_found'; end if;
  v_caller := public.member_role_in(m.company_id);
  if m.user_id = auth.uid() or m.status <> 'pending'
     or not (v_caller = 'owner' or (v_caller = 'manager' and m.role = 'staff')) then
    raise exception 'forbidden';
  end if;
  update public.store_members
     set status = case when p_approve then 'active'::public.member_status else 'rejected'::public.member_status end
   where id = p_member_id;
end $$;

-- ---------- EXECUTE nas funções -------------------------------------
revoke all on function
  public.handle_new_user(), public.members_guard(), public.orders_guard(),
  public.member_role_in(uuid), public.is_admin_of(uuid), public.is_owner_of(uuid),
  public.shares_company_as_admin(uuid), public.create_company(text, text),
  public.get_invitation_preview(text), public.accept_invitation(text), public.approve_member(uuid, boolean)
  from public, anon, authenticated;
grant execute on function
  public.member_role_in(uuid), public.is_admin_of(uuid), public.is_owner_of(uuid),
  public.shares_company_as_admin(uuid), public.create_company(text, text),
  public.accept_invitation(text), public.approve_member(uuid, boolean)
  to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;

commit;
