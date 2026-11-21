/** @type {import('next').NextConfig} */
const nextConfig = {
  // IMPORTANTE: com scope "/app/adm/" o PWA só enxerga URLs COM barra final.
  // Sem isto, "/app/adm" (sem barra) cairia fora do escopo e o Chrome mostraria a barra do navegador.
  trailingSlash: true,
  async headers() {
    return [
      { source: '/sw.js', headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' } ] },
      { source: '/manifests/:path*', headers: [
        { key: 'Content-Type', value: 'application/manifest+json' },
        { key: 'Cache-Control', value: 'public, max-age=3600' } ] },
    ];
  },
};
export default nextConfig;
