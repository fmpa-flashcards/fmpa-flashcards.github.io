/* FMPR Flashcards — service worker : application multi-pages.
   - shell (pages HTML, js, css…) : NETWORK-FIRST → chaque déploiement
     est pris en compte dès la visite suivante, avec repli sur le cache hors-ligne.
   - données (disc-*.json, index.json, plan.json, mcqm/…) : CACHE-FIRST →
     chargées à la demande par page, disponibles hors-ligne.
   Les appels Firebase / Google ne sont jamais mis en cache.
   IMPORTANT : incrémenter CACHE à chaque changement de stratégie/fichiers. */
const CACHE = 'fmpr-v24';
const CORE = [
  './', 'index.html', 'home.html', 'discipline.html', 'topic.html',
  'qcm.html', 'qcm-sujets.html', 'qcm-setup.html', 'quiz.html',
  'classement.html', 'plan.html', 'profil.html', 'pathologies.html',
  'um6ss.html', 'um6ss-quiz.html', 'um6ss-logo.png',
  'styles.css', 'firebase-config.js', 'manifest.json',
  'js/common.js', 'js/login.js', 'js/home.js', 'js/discipline.js',
  'js/topic.js', 'js/qcm.js', 'js/quiz.js', 'js/classement.js',
  'js/plan.js', 'js/profil.js', 'js/patho.js', 'js/um6ss.js', 'js/um6ss-quiz.js',
  'vendor/firebase/firebase-app.js', 'vendor/firebase/firebase-auth.js',
  'vendor/firebase/firebase-firestore.js',
];
const DATA_PATTERNS = [
  /\/disc-\d\.json$/,
  /\/index\.json$/,
  /\/topics-index\.json$/,
  /\/plan\.json$/,
  /\/mcqm-index\.json$/,
  /\/mcqm\/[\w-]+\.json$/,
  /\/patho\/.*\.json$/,
  /\/um6ss\/.*\.json$/,
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin) return; // réseau direct (Firebase, Google…)
  const isCore = CORE.some((p) =>
    p === './' ? (url.pathname === '/' || url.pathname.endsWith('/index.html'))
               : url.pathname.endsWith('/' + p));
  const isData = DATA_PATTERNS.some((re) => re.test(url.pathname));
  if (!isCore && !isData) return;

  if (isData) {
    // Données : cache d'abord (fichiers stables, chargés à la demande).
    e.respondWith(
      caches.match(e.request).then((hit) => {
        if (hit) return hit;
        return fetch(e.request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        });
      })
    );
    return;
  }
  // Shell : réseau d'abord, repli cache hors-ligne.
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
