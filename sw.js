/*
  人生即遍路 ～ 兩人同行　Service Worker
  策略：install 時 precache 全部本地資產；cache-first 讀取；
  每次部署改 CACHE_VERSION 讓舊快取失效。
  沒有對外請求（Google Fonts 的 CSS／字型例外，失敗時忽略，不影響離線使用中文與版面）。
*/
"use strict";

var CACHE_VERSION = "henro-v16";
var PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(url).catch(function () {
            /* 個別資產快取失敗不擋整體安裝（例如離線環境下先行安裝時） */
          });
        })
      );
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_VERSION; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;

  // 只處理 GET；非 GET（無實際意義，本 App 無表單送出）直接放行
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;

      return fetch(req).then(function (res) {
        // 同源資產順便補進快取，讓下次離線也能用
        try {
          var url = new URL(req.url);
          if (url.origin === self.location.origin && res && res.status === 200) {
            var resClone = res.clone();
            caches.open(CACHE_VERSION).then(function (cache) {
              cache.put(req, resClone);
            });
          }
        } catch (e) { /* ignore */ }
        return res;
      }).catch(function () {
        // 離線且未快取：導覽請求就退回首頁殼，其餘資源放棄
        if (req.mode === "navigate") {
          return caches.match("./index.html");
        }
        return new Response("", { status: 504, statusText: "Offline" });
      });
    })
  );
});
