/* ======================================================================
   剑网三收益记录 · Service Worker（PWA 离线支持）
   策略：缓存优先（cache-first），未命中时网络回退并缓存新资源；
        离线时文档请求回退到本地 index.html。
   ====================================================================== */

// 缓存版本号（更新资源时递增以触发旧缓存清理）
const CACHE_NAME = 'jx3-record-v2';

// 预缓存的核心资源清单
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/voice.js',
  './js/achievements.js',
  './js/chart.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Noto+Serif+SC:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js'
];

// 安装：预缓存核心资源（个别资源失败不影响整体安装）
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// 激活：清理旧版本缓存并接管所有客户端
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：缓存优先，网络回退，离线回退
self.addEventListener('fetch', e => {
  // 跳过非 GET 请求（如 POST 提交不缓存）
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      // 命中缓存则直接返回
      if (cached) return cached;

      // 未命中：走网络，并缓存同源的新资源
      return fetch(e.request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // 离线回退：文档请求返回本地首页
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
