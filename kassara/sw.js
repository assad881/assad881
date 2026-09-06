/* عامل الخدمة — تخزين مؤقت لملفات التطبيق للعمل دون اتصال.
   بيانات المستخدم تُحفظ في localStorage وليست جزءًا من هذا التخزين. */
const CACHE = 'kassara-v1.0.0';
const ASSETS = [
  './', './index.html', './manifest.webmanifest', './assets/css/app.css',
  './config/app.config.js',
  './src/core/util.js', './src/core/i18n.js', './src/core/store.js', './src/core/router.js',
  './src/core/audit.js', './src/core/auth.js',
  './src/data/schema.js', './src/data/driver.local.js', './src/data/driver.supabase.js',
  './src/data/repo.js', './src/data/seed.js',
  './src/domain/notify.js', './src/domain/pricing.js', './src/domain/orders.js',
  './src/domain/payments.js', './src/domain/trips.js', './src/domain/settlements.js',
  './src/domain/analytics.js',
  './src/ui/components.js', './src/ui/charts.js', './src/ui/layout.js',
  './src/ui/views/public.js', './src/ui/views/auth.js', './src/ui/views/customer.js',
  './src/ui/views/admin.js', './src/ui/views/admin-config.js', './src/ui/views/partners.js',
  './src/selftest.js', './src/app.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        /* خزّن نسخة من ملفات النطاق نفسه فقط */
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
