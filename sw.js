const CACHE = 'calcubite-v15-profile';
const ASSETS = ['/','/index.html','/app.html','/style.css','/ascent.css','/modern.css','/core.js','/presentation.js','/workspace.js','/script.js','/auth.js','/off.js','/diary.js','/onboarding.js','/vendor/zxing.min.js','/manifest.json'];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(ASSETS.map(path => cache.add(path)))));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('calcubite') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request, url=new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request);
      if (response.ok) await cache.put(request,response.clone());
      return response;
    } catch (error) {
      const stored=await cache.match(request);
      if (stored) return stored;
      if (request.mode==='navigate') return (await cache.match('/app.html')) || Response.error();
      return Response.error();
    }
  })());
});
