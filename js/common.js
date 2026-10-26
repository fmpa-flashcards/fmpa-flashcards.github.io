/* ============================================================================
   FMPA Flashcards — common.js : fondation partagée de toutes les pages.
   Firebase, auth, profil/XP, progression, sessions, utilitaires, tabbar.
   ============================================================================ */
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from '../vendor/firebase/firebase-auth.js';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  query, where, limit, orderBy, getDocs, runTransaction,
  serverTimestamp, deleteDoc, enableIndexedDbPersistence, terminate
} from '../vendor/firebase/firebase-firestore.js';
import { firebaseConfig } from '../firebase-config.js';

export const WA_NUMBER = '212605235053';
export const DEMO_N = 5;                 // cartes visibles en démo (non-Pro)
export const REF_COMMISSION = 15;        // DH par filleul parrainé
export const REF_MIN_WITHDRAW = 30;      // DH minimum pour retirer
export const DISC_ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M8 7.5 10.5 16M16 7.5 13.5 16M8.5 6h7"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5 19.5 9.5 9 20H4v-5L14.5 4.5z"/><path d="M13 6l5 5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3z"/><path d="M12 10v4M12 17.5v.5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19c4-1 5-8 8-8s4 7 8 8"/><path d="M12 11V5M10 7l2-2 2 2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-3z"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="5"/><path d="M9 4v10M4 9h10"/></svg>',
];

/* Icônes SVG partagées pour les titres et puces (jamais de glyphes emoji). */
export const ICONS = {
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c4-2 6-5.5 6-9.5 0-2.5-1-4.5-2.5-6C14 8 13 9 12.5 10 12 8 12.5 5.5 12 3c-3 2.5-5 6-5 10 0 1.5.3 3 1 4.5C8 16 7 14 7 12.5 5.5 14.5 6 19 12 22z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1c0 2 1.5 3 3 3M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3-3 3"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4"/><path d="M5 12v8h14v-8M12 8v12M12 8s-4.5.3-4.5-2.2C7.5 3.5 12 4 12 8zm0 0s4.5.3 4.5-2.2C16.5 3.5 12 4 12 8z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  med: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16M4 12h16"/><circle cx="12" cy="12" r="9"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5 14.7 8.6 20.3 9.4 16.2 13.3 17.2 18.9 12 16.2 6.8 18.9 7.8 13.3 3.7 9.4 9.3 8.6Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 3.6-2.3M12 20h.01M1.5 9a15 15 0 0 1 5-3.3M22.5 9a15 15 0 0 0-8.5-3.5"/></svg>',
};
export const icon = (name, cls) => `<span class="hic${cls ? ' ' + cls : ''}">${ICONS[name] || ''}</span>`;

/* Anneau de progression SVG (Clean Premium) : pct 0-100. */
export function ringSvg(pct) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const c = 2 * Math.PI * 15.5;
  const off = c - (p / 100) * c;
  const col = p >= 100 ? 'var(--green)' : 'var(--teal)';
  return `<svg class="ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="15.5" fill="none" stroke="var(--surface2)" stroke-width="4"/><circle cx="20" cy="20" r="15.5" fill="none" stroke="${col}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 20 20)"/><text x="20" y="24" text-anchor="middle" font-size="10" font-weight="800" fill="var(--ink)">${p}%</text></svg>`;
}

/* Profil mis en cache localement : l'accueil peut afficher « Salut {prénom} »,
   la série et l'XP immédiatement, sans attendre Firestore (c'est pour ça que
   l'accueil restait longtemps vide quand l'auth traînait). */
export function cachedProfile() {
  try { return JSON.parse(localStorage.getItem('fmpa_profile_cache') || 'null'); } catch (e) { return null; }
}
export function cacheProfile() {
  if (!profile) return;
  try {
    localStorage.setItem('fmpa_profile_cache', JSON.stringify({
      displayName: profile.displayName || '',
      nickname: profile.nickname || '',
      xp: profile.xp || 0,
      streak: profile.streak || 0,
      proTier: profile.proTier || null,
    }));
  } catch (e) {}
}

/* Capture le code de parrainage (?ref=CODE) dès le chargement. */
try {
  const rc = new URLSearchParams(location.search).get('ref');
  if (rc && /^[A-Z0-9]{4,10}$/i.test(rc)) {
    localStorage.setItem('fmpr_ref', rc.toUpperCase());
  }
} catch (e) {}

/* ------------------------------- utils -------------------------------- */
export const $ = (sel, el) => (el || document).querySelector(sel);
export const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
export const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export const qp = (k, d = '') => { const v = new URLSearchParams(location.search).get(k); return v == null ? d : v; };

export function toast(msg, ms = 2600) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.hidden = true; }, ms);
}

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function seededPick(arr, n, seed) {
  const rnd = mulberry32(seed);
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(n, arr.length)).map(i => arr[i]);
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
export function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
export function isoWeekId() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(week).padStart(2, '0');
}
export function levelFor(xp) { return Math.floor(xp / 500) + 1; }

/* ------------------------------ firebase ------------------------------ */
let _app = null, _auth = null, _db = null;
export function fb() {
  if (!_app) {
    _app = initializeApp(firebaseConfig);
    _auth = getAuth(_app);
  }
  if (!_db) {
    _db = getFirestore(_app);
    enableIndexedDbPersistence(_db).catch(() => {});
  }
  return { app: _app, auth: _auth, db: _db };
}

/* Ferme l'instance Firestore pour forcer une reconnexion propre au prochain
   appel. Utilisé entre deux tentatives quand le flux réseau semble bloqué
   (requête qui ne répond ni n'échoue). Ne bloque jamais plus de 4 s. */
async function resetDb() {
  if (!_db) return;
  const old = _db;
  _db = null;
  try {
    await Promise.race([
      terminate(old),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch (e) {}
}

/* --------------------------- session state ---------------------------- */
export let user = null;
export let profile = null;
export const proTier = () => (profile && profile.proTier) || null;
export const hasCards = () => proTier() === 'cards' || proTier() === 'full';
export const hasFull = () => proTier() === 'full';
export const isPro = () => hasCards(); // compat : tout palier payant

/* Redirige vers la page de connexion si non connecté.
   Résout quand l'utilisateur + son profil sont prêts. Ne rejette jamais.
   Anti-blocage : si le réseau est coupé, message immédiat ; sinon plusieurs
   tentatives avec délai par essai, et l'instance Firestore est recréée entre
   les essais quand le flux semble bloqué (requête qui ne répond ni n'échoue).
   En cas d'échec final, écran d'erreur avec bouton réessayer intégré
   (sans recharger toute la page). */
export function requireAuth({ timeoutMs = 15000, attempts = 3 } = {}) {
  return new Promise((resolve) => {
    const appEl = document.getElementById('app');
    if (!appEl) { resolve(); return; }

    const showLoading = () => {
      appEl.innerHTML = `<div class="lock">
        <div class="big">${ICONS.clock}</div>
        <h2>Vérification du compte…</h2>
        <p>Connexion en cours, merci de patienter.</p>
      </div>`;
    };

    const showError = (offline) => {
      appEl.innerHTML = `<div class="lock">
        <div class="big">${offline ? ICONS.wifiOff : ICONS.clock}</div>
        <h2>${offline ? 'Hors connexion' : 'Connexion lente'}</h2>
        <p>${offline
          ? 'Tu sembles hors ligne.<br>Vérifie ta connexion puis réessaie.'
          : 'La vérification de ton compte prend trop de temps.<br>Vérifie ta connexion puis réessaie.'}</p>
        <button class="btn btn-primary" id="authRetry">Réessayer</button>
      </div>`;
      const btn = document.getElementById('authRetry');
      if (btn) btn.onclick = () => { showLoading(); attemptLoop(); };
    };

    /* Un essai = état d'auth + profil, le tout borné par timeoutMs. */
    const tryOnce = () => new Promise((res, rej) => {
      const { auth } = fb();
      let unsub = null, done = false;
      const timer = setTimeout(() => {
        if (done) return; done = true;
        try { unsub && unsub(); } catch (e) {}
        rej(new Error('timeout'));
      }, timeoutMs);
      const finish = (fn) => {
        if (done) return; done = true;
        clearTimeout(timer);
        try { unsub && unsub(); } catch (e) {}
        fn();
      };
      unsub = onAuthStateChanged(auth, async (u) => {
        if (!u) { finish(() => rej(new Error('no-user'))); return; }
        user = u;
        try {
          profile = await ensureProfile(u);
          finish(() => res());
        } catch (e) {
          finish(() => rej(e));
        }
      }, (err) => finish(() => rej(err)));
    });

    const attemptLoop = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        showError(true);
        return;
      }
      for (let i = 0; i < attempts; i++) {
        if (i > 0) {
          await resetDb();
          await new Promise((r) => setTimeout(r, 700));
        }
        try {
          await tryOnce();
          cacheProfile();
          registerSession();
          resolve();
          return;
        } catch (e) {
          if (e && e.message === 'no-user') {
            location.replace('index.html');
            return;
          }
          console.warn('requireAuth essai ' + (i + 1) + '/' + attempts + ' échoué', e);
        }
      }
      showError(false);
    };

    attemptLoop();
  });
}

export async function signOutAll() {
  const { auth, db } = fb();
  clearInterval(registerSession._hb);
  try {
    const sid = sessionStorage.getItem('fmpr_sid');
    if (sid && user) await deleteDoc(doc(db, 'users', user.uid, 'sessions', sid));
  } catch (e) {}
  sessionStorage.removeItem('fmpr_sid');
  await signOut(auth);
  location.replace('index.html');
}

/* --------------------------- auth & profile ---------------------------- */
function defaultProfile(u) {
  return {
    app: 'fmpa',
    email: u.email || '',
    displayName: u.displayName || (u.email ? u.email.split('@')[0] : 'Étudiant'),
    photoURL: u.photoURL || '',
    nickname: '',
    proTier: null, // 'cards' (100 DH) | 'full' (150 DH) | null (démo)
    proSince: null,
    xp: 0, streak: 0, lastStudyDay: '',
    mcqTotal: 0, mcqCorrect: 0, cardsSeen: 0,
    discSeen: {},
    referralCode: '',
    refBalance: 0,
    refCount: 0,
    createdAt: serverTimestamp(),
  };
}

/* Génère un code de parrainage déterministe à partir de l'UID (unique, sans requête). */
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function codeFromUid(uid) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < uid.length; i++) {
    const ch = uid.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  let x = (h2 >>> 0) * 4294967296 + (h1 >>> 0);
  let code = '';
  for (let i = 0; i < 6; i++) { code += REF_ALPHABET[x % 32]; x = Math.floor(x / 32); }
  return code;
}

async function ensureProfile(u) {
  const { db } = fb();
  const ref = doc(db, 'users', u.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const d = snap.data();
    // Backfill : attribue les champs de parrainage aux anciens comptes,
    // et migre l'ancien isPro:true vers proTier:'full'.
    const needRef = !d.referralCode || d.refBalance === undefined || d.refCount === undefined;
    const needTier = d.isPro === true && !d.proTier;
    if (needRef || needTier) {
      const code = d.referralCode || codeFromUid(u.uid);
      try {
        const upd = {
          referralCode: code,
          refBalance: d.refBalance || 0,
          refCount: d.refCount || 0,
        };
        if (needTier) upd.proTier = 'full';
        await updateDoc(ref, upd);
        await setDoc(doc(db, 'refcodes', code), { uid: u.uid });
      } catch (e) { console.warn('backfill', e); }
      d.referralCode = code;
      d.refBalance = d.refBalance || 0;
      d.refCount = d.refCount || 0;
      if (needTier) d.proTier = 'full';
    }
    return d;
  }
  const p = defaultProfile(u);
  p.referralCode = codeFromUid(u.uid);
  await setDoc(ref, p);
  try { await setDoc(doc(db, 'refcodes', p.referralCode), { uid: u.uid }); } catch (e) {}
  // Parrainage : enregistre la preuve dès l'inscription (sans crédit).
  // Le crédit (+15 DH / +1 filleul) reste déclenché à l'activation Pro.
  try { await recordReferralAtSignup(db, u); } catch (e) { console.warn('referral-signup', e); }
  return (await getDoc(ref)).data();
}

/* Enregistre le parrainage à l'inscription : crée referrals/{uid} (sans crédit).
   Permet de compter les inscrits par parrain, même sans achat Pro. */
async function recordReferralAtSignup(db, u) {
  const LS_KEY = 'fmpr_ref';
  let refCode = null;
  try { refCode = localStorage.getItem(LS_KEY); } catch (e) {}
  if (!refCode || !/^[A-Z0-9]{4,10}$/i.test(refCode)) return;
  refCode = refCode.toUpperCase();
  if (refCode === codeFromUid(u.uid)) return; // pas d'auto-parrainage
  let referrerUid = null;
  try {
    const codeDoc = await getDoc(doc(db, 'refcodes', refCode));
    if (codeDoc.exists()) referrerUid = codeDoc.data().uid;
  } catch (e) { return; }
  if (!referrerUid || referrerUid === u.uid) return;
  const refDocRef = doc(db, 'referrals', u.uid);
  try {
    const existing = await getDoc(refDocRef);
    if (existing.exists()) { try { localStorage.removeItem(LS_KEY); } catch (e) {} return; }
    await setDoc(refDocRef, {
      referrerUid,
      referrerCode: refCode,
      referredUid: u.uid,
      referredEmail: u.email || '',
      commission: REF_COMMISSION,
      createdAt: serverTimestamp(),
    });
  } catch (e) { return; } // ex. règle non publiée : on réessaiera à l'activation
  try { localStorage.removeItem(LS_KEY); } catch (e) {}
}

let flushTimer = null;
export function saveProfile(patch) {
  if (!user || !profile) return;
  Object.assign(profile, patch);
  scheduleFlush();
}
function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushProfile, 2500);
}
async function flushProfile() {
  if (!user || !profile) return;
  const { db } = fb();
  try {
    const { createdAt, ...rest } = profile;
    await updateDoc(doc(db, 'users', user.uid), rest);
    pushLeaderboard();
  } catch (e) { console.warn('flush', e); }
}
let lastLbPush = 0;
export async function pushLeaderboard(force) {
  if (!user || !profile) return;
  const { db } = fb();
  const now = Date.now();
  if (!force && now - lastLbPush < 60000) return;
  lastLbPush = now;
  const nick = profile.nickname || profile.displayName || 'Étudiant';
  const payload = {
    xp: profile.xp || 0,
    nickname: nick.slice(0, 30),
    photoURL: profile.photoURL || '',
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'lb_weekly', isoWeekId(), 'users', user.uid), payload, { merge: true });
    await setDoc(doc(db, 'lb_alltime', 'users', user.uid), payload, { merge: true });
  } catch (e) { console.warn('leaderboard', e); }
}

export function addXp(n) {
  if (!profile || n <= 0) return;
  profile.xp = (profile.xp || 0) + n;
  scheduleFlush();
  touchStudy();
}
export function touchStudy() {
  if (!profile) return;
  const t = todayStr();
  if (profile.lastStudyDay === t) return;
  profile.streak = (profile.lastStudyDay === yesterdayStr()) ? (profile.streak || 0) + 1 : 1;
  profile.lastStudyDay = t;
  scheduleFlush();
}

/* --------------------- topic progress (cloud) -------------------------- */
const tpCache = {};
const tpTimers = {};
function tpDefault() { return { seen: [], starred: [], correct: 0, wrong: 0 }; }
export async function getTP(topicId) {
  if (tpCache[topicId]) return tpCache[topicId];
  const { db } = fb();
  let data = tpDefault();
  if (user) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid, 'topics', topicId));
      if (snap.exists()) data = Object.assign(tpDefault(), snap.data());
    } catch (e) { console.warn('tp load', e); }
  }
  tpCache[topicId] = data;
  return data;
}
export function saveTP(topicId) {
  clearTimeout(tpTimers[topicId]);
  tpTimers[topicId] = setTimeout(async () => {
    if (!user) return;
    const { db } = fb();
    try {
      const d = tpCache[topicId] || tpDefault();
      await setDoc(doc(db, 'users', user.uid, 'topics', topicId),
        { ...d, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) { console.warn('tp save', e); }
  }, 2000);
}
export async function markSeen(topicId, cardIdx, discIdx) {
  const tp = await getTP(topicId);
  if (!tp.seen.includes(cardIdx)) {
    tp.seen.push(cardIdx);
    profile.cardsSeen = (profile.cardsSeen || 0) + 1;
    const k = String(discIdx);
    profile.discSeen = profile.discSeen || {};
    profile.discSeen[k] = (profile.discSeen[k] || 0) + 1;
    addXp(1);
    saveTP(topicId);
    scheduleFlush();
  }
}

/* ------------------------------ sessions ------------------------------- */
/* 2 appareils connectés max par compte. Le sid vit dans sessionStorage :
   naviguer entre les pages du même onglet garde UNE seule session. */
export async function registerSession() {
  if (!user) return;
  const { auth, db } = fb();
  let sid = sessionStorage.getItem('fmpr_sid');
  const col = collection(db, 'users', user.uid, 'sessions');
  try {
    if (!sid) {
      sid = 's' + Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem('fmpr_sid', sid);
      await setDoc(doc(col, sid), { lastSeen: serverTimestamp(), ua: navigator.userAgent.slice(0, 120) });
      const snap = await getDocs(query(col, orderBy('lastSeen', 'desc')));
      const docs = snap.docs;
      for (let i = 2; i < docs.length; i++) await deleteDoc(docs[i].ref);
    } else {
      await setDoc(doc(col, sid), { lastSeen: serverTimestamp() }, { merge: true });
    }
  } catch (e) { console.warn('session', e); }
  clearInterval(registerSession._hb);
  registerSession._hb = setInterval(async () => {
    if (!user) return;
    try {
      const ref = doc(db, 'users', user.uid, 'sessions', sid);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        clearInterval(registerSession._hb);
        sessionStorage.removeItem('fmpr_sid');
        await signOut(auth);
        location.replace('index.html');
        return;
      }
      await updateDoc(ref, { lastSeen: serverTimestamp() });
    } catch (e) {}
  }, 60000);
}
export async function listSessions() {
  if (!user) return [];
  const { db } = fb();
  try {
    const snap = await getDocs(query(
      collection(db, 'users', user.uid, 'sessions'), orderBy('lastSeen', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

/* --------------------------- data loading ----------------------------- */
let _index = null;
const _discs = {};
const _topicsById = {};
export async function loadIndex() {
  if (_index) return _index;
  _index = await (await fetch('index.json')).json();
  return _index;
}
export async function loadDisc(i) {
  if (_discs[i]) return _discs[i];
  const idx = await loadIndex();
  const disc = await (await fetch(idx[i].file)).json();
  _discs[i] = disc;
  for (const t of disc.topics) _topicsById[t.id] = { discIdx: i, topic: t };
  return disc;
}
export async function loadAllDiscs() {
  const idx = await loadIndex();
  for (let i = 0; i < idx.length; i++) await loadDisc(i);
}
export function topicEntry(id) { return _topicsById[id] || null; }
let _plan = null;
export async function loadPlan() {
  if (_plan) return _plan;
  _plan = await (await fetch('plan.json')).json();
  return _plan;
}
let _mcqmIndex = null;
export async function loadMcqmIndex() {
  if (_mcqmIndex) return _mcqmIndex;
  _mcqmIndex = await (await fetch('mcqm-index.json')).json();
  return _mcqmIndex;
}
/* Banque QCM multi-réponses d'un sujet : [{q, options[5], correct[2..4], explain[5]}] */
export async function loadTopicMcqm(topicId) {
  const r = await fetch('mcqm/' + topicId + '.json');
  if (!r.ok) throw new Error('Banque QCM introuvable pour ' + topicId);
  return r.json();
}

/* ------------------------------ UI shell ------------------------------- */
export function waUnlockLink() {
  const txt = encodeURIComponent('Salut ! Je veux débloquer Flashcards FMPA (100 DH). Mon email de compte : ');
  return 'https://wa.me/' + WA_NUMBER + '?text=' + txt;
}

/* Icônes SVG en ligne — jamais de glyphes de police (ils se coupent
   sur téléphone). Chaque icône est centrée dans un conteneur .bic de 24 px. */
const TAB_ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>',
  leaderboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1c0 2 1.5 3 3 3M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3-3 3"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5"/></svg>',
};

export function tabbar(active) {
  const tabs = [
    ['home.html', 'home', 'Cartes'],
    ['classement.html', 'leaderboard', 'Classement'],
    ['plan.html', 'plan', 'Plan'],
    ['profil.html', 'profile', 'Profil'],
  ];
  return '<nav class="tabbar">' + tabs.map(([href, key, label]) =>
    `<a href="${href}" class="${key === active ? 'on' : ''}"><span class="bic">${TAB_ICONS[key] || ''}</span><span>${label}</span></a>`
  ).join('') + '</nav>';
}

export function lockHtml(feature) {
  return `<div class="lock">
    <div class="big">${ICONS.lock}</div>
    <h2>${feature} — Version complète</h2>
    <p>Débloque les 6 861 cartes et le classement pour <b>100 DH</b>.<br>Paiement unique, à vie.</p>
    <a class="btn btn-primary" href="${waUnlockLink()}" target="_blank" rel="noopener"
       style="text-decoration:none">Commander sur WhatsApp</a>
    <div class="hr">ou entre ton code d'activation</div>
    <div class="code-row">
      <input class="input" id="redeemInput" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off">
      <button class="btn btn-ghost" id="redeemBtn" style="width:auto;margin-top:0;flex:none">OK</button>
    </div>
  </div>`;
}
export function bindRedeem() {
  const b = $('#redeemBtn');
  if (b) b.onclick = () => redeemCode($('#redeemInput').value);
}
/* Verrou version complète (FMPA : une seule formule à 100 DH). */
export function guardPro(feature, tab) {
  if (hasCards()) return true;
  $('#app').innerHTML = lockHtml(feature);
  document.body.insertAdjacentHTML('beforeend', tabbar(tab));
  bindRedeem();
  return false;
}
/* Verrou formule Full (QCM). */
export function guardFull(feature, tab) {
  if (hasFull()) return true;
  $('#app').innerHTML = lockHtml(feature, true);
  document.body.insertAdjacentHTML('beforeend', tabbar(tab));
  bindRedeem();
  return false;
}

export async function redeemCode(raw) {
  const code = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 16) { toast('Code invalide : vérifie le format XXXX-XXXX-XXXX-XXXX.'); return; }
  toast('Vérification du code…');
  const { db } = fb();
  let h;
  try { h = await sha256hex(code); } catch (e) { toast('Erreur technique, réessaie.'); return; }
  const snap = await getDocs(query(collection(db, 'codes'), where('codeHash', '==', h), limit(5)));
  const target = snap.docs.find(d => !d.data().used);
  if (!target) { toast('Code invalide ou déjà utilisé.'); return; }
  const codeRef = target.ref;
  const codeTier = target.data().tier === 'full' ? 'full' : 'cards';
  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(codeRef);
      if (!s.exists() || s.data().used) throw new Error('already-used');
      tx.update(codeRef, { used: true, usedBy: user.uid, usedAt: serverTimestamp() });
    });
  } catch (e) { toast("Ce code vient d'être utilisé."); return; }
  try {
    await setDoc(doc(db, 'claims', user.uid), { serial: target.id, at: serverTimestamp() });
    await updateDoc(doc(db, 'users', user.uid), { proTier: codeTier, proSince: serverTimestamp() });
  } catch (e) { toast("Erreur d'activation — contacte-nous sur WhatsApp."); return; }
  profile.proTier = codeTier;
  // Parrainage : crédite le parrain si un code ?ref= a été capturé.
  try { await creditReferrer(db); } catch (e) { console.warn('referral', e); }
  toast(codeTier === 'full' ? 'Version Full activée ! Bonnes révisions !' : 'Formule Cartes activée ! Bonnes révisions !');
  setTimeout(() => location.reload(), 900);
}

/* Crédite le parrain (15 DH) quand un filleul active son Pro. */
/* Crédite le parrain (+15 DH / +1 filleul) quand un filleul active son Pro.
   La preuve referrals/{uid} est créée à l'inscription (recordReferralAtSignup) ;
   ce chemin gère aussi les comptes créés avant (preuve créée ici en migration). */
async function creditReferrer(db) {
  if (profile.refCredited) return; // déjà crédité : un seul parrainage par filleul
  const LS_KEY = 'fmpr_ref';
  const refDocRef = doc(db, 'referrals', user.uid);
  let refDoc = null;
  try { refDoc = await getDoc(refDocRef); } catch (e) { return; }
  if (!refDoc.exists()) {
    // Migration : compte créé avant l'enregistrement à l'inscription.
    let refCode = null;
    try { refCode = localStorage.getItem(LS_KEY); } catch (e) {}
    if (!refCode || !/^[A-Z0-9]{4,10}$/i.test(refCode)) return;
    refCode = refCode.toUpperCase();
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    if (refCode === profile.referralCode) return; // pas d'auto-parrainage
    let referrerUid = null;
    try {
      const codeDoc = await getDoc(doc(db, 'refcodes', refCode));
      if (codeDoc.exists()) referrerUid = codeDoc.data().uid;
    } catch (e) { return; }
    if (!referrerUid || referrerUid === user.uid) return;
    try {
      await setDoc(refDocRef, {
        referrerUid,
        referrerCode: refCode,
        referredUid: user.uid,
        referredEmail: profile.email || '',
        commission: REF_COMMISSION,
        createdAt: serverTimestamp(),
      });
      refDoc = await getDoc(refDocRef);
    } catch (e) { return; }
  }
  const referrerUid = refDoc.data().referrerUid;
  if (!referrerUid || referrerUid === user.uid) return;
  const referrerRef = doc(db, 'users', referrerUid);
  try {
    await runTransaction(db, async (tx) => {
      const rsnap = await tx.get(referrerRef);
      if (!rsnap.exists()) throw new Error('no-referrer');
      const rd = rsnap.data();
      tx.update(referrerRef, {
        refBalance: (rd.refBalance || 0) + REF_COMMISSION,
        refCount: (rd.refCount || 0) + 1,
      });
    });
    // Marque le crédit comme effectué (updateDoc direct : pas de debounce).
    try { await updateDoc(doc(db, 'users', user.uid), { refCredited: true }); } catch (e) {}
    profile.refCredited = true;
  } catch (e) { console.warn('referral-credit', e); }
}