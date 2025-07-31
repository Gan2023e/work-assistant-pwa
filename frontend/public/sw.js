const CACHE_NAME = 'work-assistant-pwa-v2.0.5';
const APP_VERSION = '2.0.5';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png',
  '/offline.html'
];

// 安装事件 - 缓存资源并立即激活
self.addEventListener('install', (event) => {
  console.log('PWA Service Worker: 安装新版本', APP_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('PWA Service Worker: 缓存已打开');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // 强制跳过等待，立即激活新版本
        return self.skipWaiting();
      })
  );
});

// 激活事件 - 清理旧缓存并通知客户端更新
self.addEventListener('activate', (event) => {
  console.log('PWA Service Worker: 激活新版本', APP_VERSION);
  event.waitUntil(
    Promise.all([
      // 清理所有旧缓存
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('PWA Service Worker: 删除旧缓存', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // 立即控制所有客户端
      self.clients.claim()
    ]).then(() => {
      // 通知所有客户端有更新可用
      return self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_UPDATE_AVAILABLE',
            version: APP_VERSION
          });
        });
      });
    })
  );
});

// 拦截网络请求 - 使用网络优先策略确保获取最新内容
self.addEventListener('fetch', (event) => {
  // 过滤掉不支持的URL scheme
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return; // 不处理非HTTP/HTTPS请求（如chrome-extension:// 等）
  }

  // 对于导航请求和API请求，使用网络优先策略
  if (event.request.mode === 'navigate' || event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 如果网络请求成功，且响应可缓存，更新缓存
          if (
            response &&
            response.status === 200 &&
            (response.type === 'basic' || response.type === 'cors')
          ) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                if (event.request.method === 'GET') {
                  cache.put(event.request, responseToCache).catch((error) => {
                    console.warn('PWA Service Worker: 缓存失败，可能是URL scheme不支持:', error);
                  });
                }
              })
              .catch((error) => {
                console.warn('PWA Service Worker: 打开缓存失败:', error);
              });
          }
          return response;
        })
        .catch(() => {
          // 网络失败时返回缓存
          return caches.match(event.request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // 如果是导航请求，返回离线页面
              if (event.request.mode === 'navigate') {
                return caches.match('/offline.html');
              }
              return caches.match('/');
            });
        })
    );
  } else {
    // 对于静态资源，先检查缓存，但定期更新
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          // 总是尝试从网络获取最新版本
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (
                response &&
                response.status === 200 &&
                (response.type === 'basic' || response.type === 'cors')
              ) {
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(event.request, responseToCache).catch((error) => {
                      console.warn('PWA Service Worker: 缓存失败，可能是URL scheme不支持:', error);
                    });
                  })
                  .catch((error) => {
                    console.warn('PWA Service Worker: 打开缓存失败:', error);
                  });
              }
              return response;
            })
            .catch(() => cachedResponse);

          // 如果有缓存，立即返回，同时在后台更新
          return cachedResponse || fetchPromise;
        })
    );
  }
});

// 监听来自客户端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CHECK_UPDATE') {
    // 检查更新
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        type: 'UPDATE_CHECK_RESULT',
        hasUpdate: true,
        version: APP_VERSION
      });
    }
  }
});

// 后台同步
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('PWA Service Worker: 执行后台同步');
    // 在这里可以添加后台同步逻辑
  }
});

// 推送通知
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : '您有新的工作通知',
    icon: '/logo192.png',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: '查看详情',
        icon: '/logo192.png'
      },
      {
        action: 'close',
        title: '关闭',
        icon: '/logo192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('工作助手PWA', options)
  );
});

// 处理通知点击
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'explore') {
    // 打开应用
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'close') {
    // 关闭通知
    event.notification.close();
  } else {
    // 默认动作
    event.waitUntil(
      clients.openWindow('/')
    );
  }
}); 