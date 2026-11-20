/* ============================================================================
   Révision espacée — moteur + stockage + carte d'accueil.
   Module autonome et défensif (même patron que js/atlas-promo.js) : il ne
   doit jamais casser l'app hôte. Importé par home.html ; ses fonctions sont
   réutilisées par js/review.js (session de révision).

   Stockage : localStorage d'abord (instantané + hors-ligne), Firestore
   ensuite (users/{uid}/meta/sr — déjà autorisé par firestore.rules, aucune
   règle à changer). La copie la plus récente gagne (champ updatedAt).
   ============================================================================ */
import {
  fb, requireAuth, user, isPro,
  todayStr, yesterdayStr,
} from './common.js';
/* Primitives Firestore importées du même module vendeur que common.js
   (même instance du SDK — les 6 autres apps ne les ré-exportent pas). */
import { doc, getDoc, setDoc, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';
import {
  GRADES, GRADE_LABELS, nextState, intervalLabel,
  isDue, isMastered, computeStats, dueQueue, parseKey, makeKey,
} from './sr-scheduler.js';

/* Faculté déduite du domaine (fmpr / fmpa / …), pour les clés locales. */
export const FAC = (() => {
  const h = location.hostname;
  if (h.endsWith('.flashcartes.com')) return h.split('.')[0];
  const m = /^([a-z]+)-flashcards\.github\.io$/.exec(h);
  if (m) return m[1];
  /* APK (app.local) : les 7 facultés partagent la même origine, la
     faculté est le 1er segment du chemin (/fmpa/home.html). Sans ça,
     les 7 facultés partageraient la clé fmpr_sr_v1 et leurs cartes de
     révision se mélangeraient. */
  const seg = (location.pathname || '').split('/').filter(Boolean)[0];
  if (['fmpr', 'fmpa', 'fmpt', 'fmpc', 'fmpo', 'fmpf', 'fmpm'].includes(seg)) return seg;
  return 'fmpr';
})();
export const LS_KEY = `${FAC}_sr_v1`;
export const SESSION_SIZE = 20;   // cartes par session de révision
export const NEW_PER_DAY = 10;    // nouvelles cartes max par jour

export function emptyState() {
  return { v: 1, cards: {}, stats: { lastDay: '', streak: 0, total: 0 }, updatedAt: 0 };
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== 'object' || !s.cards) return null;
    return s;
  } catch (e) { return null; }
}

function writeLocal(state) {
  try {
    state.updatedAt = Date.now();
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch (e) { /* stockage plein ou indisponible : on continue en mémoire */ }
}

let mem = null;
let saveTimer = null;

export function loadSR() {
  if (mem) return mem;
  mem = readLocal() || emptyState();
  return mem;
}

/* Synchro Firestore : la copie la plus récente gagne. Appelée après l'auth. */
export async function syncFromCloud() {
  const local = loadSR();
  let u = null;
  try { u = user; } catch (e) { /* pas encore connecté */ }
  if (!u) return local;
  try {
    const { db } = fb();
    const snap = await getDoc(doc(db, 'users', u.uid, 'meta', 'sr'));
    if (snap.exists()) {
      const cloud = snap.data();
      if (cloud && cloud.cards && (cloud.updatedAt || 0) > (local.updatedAt || 0)) {
        mem = { v: 1, cards: cloud.cards || {}, stats: cloud.stats || { lastDay: '', streak: 0, total: 0 }, updatedAt: cloud.updatedAt || 0 };
        writeLocal(mem);
        refreshHomeCard();
      } else if ((local.updatedAt || 0) > (cloud.updatedAt || 0) && Object.keys(local.cards).length) {
        await pushToCloud();
      }
    } else if (Object.keys(local.cards).length) {
      await pushToCloud();
    }
  } catch (e) { console.warn('sr sync', e); }
  refreshHomeCard();
  return mem;
}

async function pushToCloud() {
  let u = null;
  try { u = user; } catch (e) {}
  if (!u || !mem) return;
  try {
    const { db } = fb();
    await setDoc(doc(db, 'users', u.uid, 'meta', 'sr'),
      { ...mem, serverAt: serverTimestamp() }, { merge: true });
  } catch (e) { console.warn('sr push', e); }
}

/* Sauvegarde : locale immédiate + cloud différée (2 s, comme saveTP). */
export function saveSR() {
  if (!mem) return;
  writeLocal(mem);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushToCloud, 2000);
  refreshHomeCard();
}

/** Enregistre une réponse et met à jour la série (jours consécutifs). */
export function gradeCard(key, grade, now = Date.now()) {
  const st = loadSR();
  const prev = st.cards[key] || null;
  st.cards[key] = nextState(prev, grade, now);
  const today = todayStr();
  if (st.stats.lastDay !== today) {
    st.stats.streak = st.stats.lastDay === yesterdayStr() ? (st.stats.streak || 0) + 1 : 1;
    st.stats.lastDay = today;
  }
  st.stats.total = Object.keys(st.cards).length;
  saveSR();
  return st.cards[key];
}

export function getStats() {
  return computeStats(loadSR().cards);
}

export function getDueQueue() {
  return dueQueue(loadSR().cards);
}

/* ------------------------- carte d'accueil ------------------------------ */
function cardHtml() {
  const st = loadSR();
  const s = computeStats(st.cards);
  const pro = (() => { try { return isPro(); } catch (e) { return false; } })();
  const btn = pro
    ? `<a class="btn btn-primary" href="review.html" style="display:block;text-align:center;text-decoration:none">Commencer la révision</a>`
    : `<a class="btn btn-primary" href="profil.html" style="display:block;text-align:center;text-decoration:none">Débloquer avec Pro</a>`;
  const line = s.total === 0
    ? `<div class="sr-due">Aucune carte suivie pour l'instant</div>`
    : `<div class="sr-due">${s.due} <small>carte${s.due > 1 ? 's' : ''} à réviser aujourd'hui</small></div>
       <div class="sr-bar"><i style="width:${s.upToDate}%"></i></div>
       <div class="sr-barlbl">${s.upToDate} % de tes cartes sont à jour</div>`;
  return `<span class="sr-badge">NOUVEAU</span>
    <h2>Révision espacée</h2>
    <p class="sr-sub">Tes cartes reviennent juste avant que tu les oublies.</p>
    ${line}
    ${btn}
    <div class="sr-stats">
      <div><b>${s.mastered}</b><span>maîtrisées</span></div>
      <div><b>${s.learning}</b><span>en cours</span></div>
      <div><b>${s.due}</b><span>à revoir</span></div>
    </div>`;
}

function injectStyle() {
  if (document.getElementById('srStyle')) return;
  const stEl = document.createElement('style');
  stEl.id = 'srStyle';
  stEl.textContent = `
/* Variables du thème de l'app (clair/sombre automatiques). */
.sr-card{display:block;position:relative;background:var(--surface);border-radius:14px;padding:16px;
  margin:0 0 14px;box-shadow:var(--shadow2);border:1.5px solid var(--teal)}
.sr-card .sr-badge{position:absolute;top:-9px;right:14px;background:var(--teal);color:#fff;
  font-size:10px;font-weight:800;letter-spacing:.08em;padding:3px 8px;border-radius:99px}
.sr-card h2{font-size:18px;color:var(--ink)}
.sr-card .sr-sub{font-size:13px;color:var(--muted);margin-top:3px}
.sr-card .sr-due{font-size:30px;font-weight:800;color:var(--ink);margin-top:10px}
.sr-card .sr-due small{font-size:13px;font-weight:600;color:var(--muted)}
.sr-card .sr-bar{height:8px;background:var(--surface2);border-radius:99px;margin:10px 0 5px;overflow:hidden}
.sr-card .sr-bar i{display:block;height:100%;background:var(--teal);border-radius:99px}
.sr-card .sr-barlbl{font-size:12px;color:var(--muted)}
.sr-card .btn{margin-top:12px}
.sr-stats{display:flex;gap:8px;margin-top:12px}
.sr-stats div{flex:1;text-align:center;background:var(--surface2);border-radius:10px;padding:8px 4px}
.sr-stats b{display:block;font-size:16px;color:var(--ink)}
.sr-stats span{font-size:10px;color:var(--muted)}`;
  document.head.appendChild(stEl);
}

function mountHomeCard() {
  if (document.querySelector('.sr-card')) return false;
  /* Ancre : juste après la carte Atlas (si présente), sinon après Reprendre. */
  const anchor = document.querySelector('.atlas-card')
    || document.getElementById('resumeSlot')
    || document.querySelector('.xpbar');
  if (!anchor || !anchor.parentNode) return false;
  injectStyle();
  const card = document.createElement('div');
  card.className = 'sr-card';
  card.innerHTML = cardHtml();
  anchor.parentNode.insertBefore(card, anchor.nextSibling);
  return true;
}

export function refreshHomeCard() {
  const card = document.querySelector('.sr-card');
  if (card) card.innerHTML = cardHtml();
}

/* Démarrage : ne s'exécute que sur l'accueil (ancre présente). */
let tries = 0;
function boot() {
  if (mountHomeCard()) {
    /* Re-rendre la carte une fois le profil chargé : isPro() lit proTier()
       en synchrone, donc au premier rendu (avant requireAuth) le profil est
       encore null et même un compte Pro voit « Débloquer avec Pro ».
       Sans ce re-rendu, la carte restait fausse (syncFromCloud ne la
       rafraîchit que si la copie cloud est plus récente). */
    try {
      requireAuth().then(() => { refreshHomeCard(); return syncFromCloud(); }).catch(() => {});
    } catch (e) {}
    return;
  }
  if (tries++ < 80) setTimeout(boot, 100);
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
