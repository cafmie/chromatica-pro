
const CACHE_NAME = 'chromatica-v1';
// ビルド後は .tsx などのファイルは存在しないため、キャッシュ対象から外します。
// 基本的なリソースのみをキャッシュし、あとは動的に処理します。
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(err => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((response) => {
      // キャッシュがあれば返し、なければネットワークから取得
      return response || fetch(event.request).then(fetchRes => {
        return fetchRes;
      });
    }).catch(() => {
      return fetch(event.request);
    })
  );
});
