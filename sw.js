/* 离线缓存：同源文件「网络优先、失败时回退缓存」。
   这样每次发布后联网打开总能拿到最新内容，没网时仍能读已经加载过的页面。
   远程图床的图片不在这里缓存。 */
var CACHE = 'bd-pwa-1';
var SHELL = ['./', 'index.html', 'manifest.webmanifest',
  'assets/style.css', 'assets/app.js', 'assets/offline-data.js',
  'assets/icons/icon-192.png', 'assets/icons/apple-touch-icon.png'];
var TIMEOUT_MS = 4000;

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 同一路径只保留最新的 ?v= 版本，避免旧版本越积越多 */
function store(req, res) {
  return caches.open(CACHE).then(function (c) {
    var path = new URL(req.url).pathname;
    return c.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        var u = new URL(k.url);
        return u.pathname === path && u.search !== new URL(req.url).search;
      }).map(function (k) { return c.delete(k); }));
    }).then(function () { return c.put(req, res); });
  });
}

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    if (req.mode === 'navigate') return caches.match('index.html').then(function (h) { return h || caches.match('./'); });
    return undefined;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(new Promise(function (resolve) {
    var done = false;
    /* final=false：网络慢时先用缓存顶上，但缓存里没有就继续等网络，不报错 */
    function fallback(final) {
      fromCache(req).then(function (hit) {
        if (done) return;
        if (hit) { done = true; resolve(hit); }
        else if (final) { done = true; resolve(Response.error()); }
      });
    }
    var timer = setTimeout(function () { fallback(false); }, TIMEOUT_MS);
    fetch(req).then(function (res) {
      clearTimeout(timer);
      if (res && res.ok) {
        var copy = res.clone();
        store(req, copy).catch(function () {});
      }
      if (done) return;
      done = true;
      resolve(res);
    }).catch(function () {
      clearTimeout(timer);
      fallback(true);
    });
  }));
});
