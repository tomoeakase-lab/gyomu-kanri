const CACHE_NAME = 'ims-cache-v1';

// キャッシュするファイル（Firebase SDKは変わらないのでキャッシュ対象）
const SDK_URLS = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js'
];

// インストール：Firebase SDKをキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SDK_URLS))
      .then(() => self.skipWaiting())
  );
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ戦略
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Firestore / Firebase API → 常にネットワーク（リアルタイム同期を維持）
  if (
    url.includes('googleapis.com') ||
    url.includes('firebaseio.com') ||
    url.includes('firestore') ||
    url.includes('firebase.googleapis')
  ) {
    return; // ブラウザに任せる
  }

  // Firebase SDK（gstatic.com）→ キャッシュ優先
  if (url.includes('gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(response => {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
          return response;
        });
      })
    );
    return;
  }

  // index.html → ネットワーク優先（更新を即反映）、オフライン時はキャッシュ
  e.respondWith(
    fetch(e.request)
      .then(response => {
        if (response.ok) {
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, response.clone()));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
