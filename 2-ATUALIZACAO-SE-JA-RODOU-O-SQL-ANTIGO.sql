-- Rode SOMENTE se você já tinha colado o 1-COLAR-NO-SUPABASE.sql antigo.
-- (Instalação nova: NÃO precisa, o arquivo 1 já vem corrigido.)
create or replace function public.accept_invitation(p_token text) returns uuid
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

create or replace function public.orders_guard() returns trigger
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
