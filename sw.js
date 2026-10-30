/* =========================================================
   Service worker — cho app chạy được khi không có mạng
   Chiến lược: ưu tiên mạng (luôn lấy bản mới nhất),
   mạng chậm quá 3 giây hoặc mất mạng → dùng bản đã lưu.
   Khi sửa danh sách file, tăng số phiên bản CACHE.
   ========================================================= */

const CACHE = 'expense-tracker-v3';
const ASSETS = [
  './',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/util.js',
  'js/store.js',
  'js/views.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];
const NETWORK_TIMEOUT = 3000;

/* ---------- Cài đặt: lưu sẵn toàn bộ file app ---------- */
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

/* ---------- Kích hoạt: xoá cache phiên bản cũ ---------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* ---------- Lấy file ---------- */
function fromNetwork(request) {
  return fetch(request).then((res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(request, copy));
    }
    return res;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    const network = fromNetwork(req);

    if (!cached) {
      try {
        return await network;
      } catch (err) {
        if (req.mode === 'navigate') {
          const shell = await caches.match('./');
          if (shell) return shell;
        }
        return Response.error();
      }
    }

    const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT));
    return Promise.race([network.catch(() => cached), timeout]);
  })());
});
