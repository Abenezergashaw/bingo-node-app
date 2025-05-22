const CACHE_NAME = "audio-cache-v1";
const AUDIO_URL = "https://santimbingo.duckdns.org/assets/start.m4a";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.add(AUDIO_URL);
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.url === AUDIO_URL) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return (
          cachedResponse ||
          fetch(event.request).then((response) => {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
              return response;
            });
          })
        );
      })
    );
  }
});
