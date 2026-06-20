importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log('Workbox service worker loaded successfully! 🎉');

  // Cache page assets (HTML, JS, CSS, localized images)
  // Stale-While-Revalidate for the main index.html to ensure users get fast updates but can open offline
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate' || request.destination === 'document',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'html-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Days
        }),
      ],
    })
  );

  // Cache JS, CSS, and manifest files with Stale-While-Revalidate
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'script' || request.destination === 'style' || request.destination === 'manifest',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Cache static image assets (local or external), especially Unsplash product images
  // Cache-First strategy to ensure super fast loading and zero data consumption on subsequent sessions
  workbox.routing.registerRoute(
    ({ request, url }) => request.destination === 'image' || 
                          url.origin.includes('unsplash.com') || 
                          url.origin.includes('images.unsplash.com'),
    new workbox.strategies.CacheFirst({
      cacheName: 'image-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 150,
          maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Days
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  // Cache Leaflet Map tiles (openstreetmap or similar tile providers)
  // Essential for allowing Google-style Map location picker to work flawlessly offline in rural areas!
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('tile.openstreetmap.org') || 
                  url.hostname.includes('basemaps.cartocdn.com') ||
                  url.pathname.includes('/tile/'),
    new workbox.strategies.CacheFirst({
      cacheName: 'map-tiles-cache',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 250,
          maxAgeSeconds: 90 * 24 * 60 * 60, // 90 Days
          purgeOnQuotaError: true,
        }),
      ],
    })
  );

  // Cache web fonts (Google Fonts API and font files)
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || 
                  url.origin === 'https://fonts.gstatic.com' ||
                  url.pathname.endsWith('.woff') || 
                  url.pathname.endsWith('.woff2') || 
                  url.pathname.endsWith('.ttf'),
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts',
      plugins: [
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Year
        }),
      ],
    })
  );

  // Auto skipWaiting and claim clients immediately so the service worker takes effect on first load
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', () => self.clients.claim());
} else {
  console.log('Failed to load Workbox service worker.');
}
