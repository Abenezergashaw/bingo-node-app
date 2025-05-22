// const CACHE_NAME = "audio-cache-v1";
// const AUDIO_URL = "https://santimbingo.duckdns.org/assets/start.m4a";

// self.addEventListener("install", (event) => {
//   event.waitUntil(
//     caches.open(CACHE_NAME).then((cache) => {
//       return cache.add(AUDIO_URL);
//     })
//   );
// });

// self.addEventListener("fetch", (event) => {
//   if (event.request.url === AUDIO_URL) {
//     event.respondWith(
//       caches.match(event.request).then((cachedResponse) => {
//         return (
//           cachedResponse ||
//           fetch(event.request).then((response) => {
//             return caches.open(CACHE_NAME).then((cache) => {
//               cache.put(event.request, response.clone());
//               return response;
//             });
//           })
//         );
//       })
//     );
//   }
// });

const CACHE_NAME = "audio-cache-v1";
const AUDIO_BASE_URL = "https://santimbingo.duckdns.org/assets/";
const AUDIO_FILES = Array.from(
  { length: 75 },
  (_, i) => `${AUDIO_BASE_URL}${i + 1}.m4a`
);

self.addEventListener("install", (event) => {
  self.skipWaiting(); // Activate this SW immediately (for dev)
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching audio files...");
      return cache.addAll(AUDIO_FILES);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim()); // Take control immediately
});

self.addEventListener("fetch", (event) => {
  const requestUrl = event.request.url;

  if (AUDIO_FILES.includes(requestUrl)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          console.log("Serving from cache:", requestUrl);
          return cachedResponse;
        }

        console.log("Fetching from network:", requestUrl);
        return fetch(event.request).then((response) => {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
