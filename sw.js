/* ============================================================
   Service Worker do Raiz
   Estratégia: NETWORK-FIRST para o index.html.
   Isso garante que toda visita com internet puxa a versão mais
   recente do deploy — sem esse cuidado, o navegador só percebe
   que há algo novo quando o PRÓPRIO sw.js muda de bytes, e o app
   ficaria preso numa versão antiga do HTML por tempo indefinido.
   O cache serve só de fallback pra abrir o app offline.
   Chamadas ao Supabase NUNCA são cacheadas.
   ============================================================ */
const CACHE = 'raiz-v1';
const APP_SHELL = ['/icon-192.png', '/icon-512.png', '/manifest.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Chamadas ao Supabase: sempre rede, nunca cache
  if (url.hostname.includes('supabase.co')) return;
  if (e.request.method !== 'GET') return;

  // Navegação (o HTML principal): rede primeiro, cache só se estiver offline.
  // É isso que garante que toda atualização do index.html aparece na hora.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          caches.open(CACHE).then(c => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/icon-192.png')))
    );
    return;
  }

  // Ícones/manifest: cache-first (raramente mudam, ok servir do cache)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

