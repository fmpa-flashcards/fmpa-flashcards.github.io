/* ============================================================================
   Flashcards FMPR — application complète (Comptes + Progression cloud + QCM
   + Classement). Cloudflare Pages (statique) + Firebase (Auth + Firestore).
   ============================================================================ */
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut
} from 'firebase/auth';
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, collection,
  query, where, limit, orderBy, getDocs, runTransaction,
  serverTimestamp, deleteDoc, enableIndexedDbPersistence
} from 'firebase/firestore';
import { firebaseConfig } from './firebase-config.js';

/* ------------------------------- config ------------------------------- */
const CONFIG_OK = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('COLLE');
const WA_NUMBER = '212605235053';
const DEMO_N = 5;                 // cartes visibles en démo (non-Pro)
const DISC_EMOJI = ['🫀', '🦴', '🧬', '🔪', '🚨'];

let app = null, auth = null, db = null;
if (CONFIG_OK) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  enableIndexedDbPersistence(db).catch(() => {}); // offline-first
}

/* ------------------------------- state -------------------------------- */
const S = {
  user: null,
  profile: null,          // doc users/{uid}
  index: null,            // data/index.json
  discs: {},              // discIdx -> {name, topics}
  topicsById: {},         // topicId -> {discIdx, topic}
  mcqBank: {},            // discIdx -> {topicId: [[d1,d2,d3], ...]} | null
  tpCache: {},            // topicId -> {seen:[], starred:[], correct, wrong}
  tpTimers: {},           // debounce timers per topic
  plan: null,
  planState: null,        // {startDate, checks:{}}
  planTimer: null,
  sessionId: null,
  heartbeat: null,
  pendingXp: 0,           // XP gagné pas encore écrit
  flushTimer: null,
  lastLbPush: 0,
  quiz: null,
  flip: null,
  lbTab: 'weekly',
  openWeek: null,
};

/* ------------------------------- utils -------------------------------- */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(t._h);
  t._h = setTimeout(() => { t.hidden = true; }, ms);
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededPick(arr, n, seed) {
  const rnd = mulberry32(seed);
  const idx = arr.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, Math.min(n, arr.length)).map(i => arr[i]);
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function isoWeekId() {
  const d = new Date();
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + String(week).padStart(2, '0');
}
function levelFor(xp) { return Math.floor(xp / 500) + 1; }

/* --------------------------- data loading ----------------------------- */
async function loadIndex() {
  if (S.index) return S.index;
  const r = await fetch('index.json');
  S.index = await r.json();
  return S.index;
}
async function loadDisc(i) {
  if (S.discs[i]) return S.discs[i];
  const idx = await loadIndex();
  const r = await fetch(idx[i].file);
  const disc = await r.json();
  S.discs[i] = disc;
  for (const t of disc.topics) S.topicsById[t.id] = { discIdx: i, topic: t };
  return disc;
}
async function loadAllDiscs() {
  const idx = await loadIndex();
  for (let i = 0; i < idx.length; i++) await loadDisc(i);
}
async function loadPlan() {
  if (S.plan) return S.plan;
  const r = await fetch('plan.json');
  S.plan = await r.json();
  return S.plan;
}
async function loadMcqBank(i) {
  if (S.mcqBank[i] !== undefined) return S.mcqBank[i];
  try {
    const r = await fetch('mcq-' + i + '.json');
    if (!r.ok) throw new Error('no bank');
    S.mcqBank[i] = await r.json();
  } catch (e) { S.mcqBank[i] = null; }
  return S.mcqBank[i];
}

/* --------------------------- auth & profile ---------------------------- */
function defaultProfile(user) {
  return {
    email: user.email || '',
    displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'Étudiant'),
    photoURL: user.photoURL || '',
    nickname: '',
    isPro: false,
    proSince: null,
    xp: 0, streak: 0, lastStudyDay: '',
    mcqTotal: 0, mcqCorrect: 0, cardsSeen: 0,
    discSeen: {},            // discIdx -> nb cartes vues (agrégat)
    createdAt: serverTimestamp(),
  };
}

async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    S.profile = snap.data();
  } else {
    const p = defaultProfile(user);
    await setDoc(ref, p);
    const s2 = await getDoc(ref);
    S.profile = s2.data();
  }
  S.isPro = !!S.profile.isPro;
}

async function saveProfile(patch) {
  if (!S.user || !S.profile) return;
  Object.assign(S.profile, patch);
  scheduleFlush();
}
function scheduleFlush() {
  clearTimeout(S.flushTimer);
  S.flushTimer = setTimeout(flushProfile, 2500);
}
async function flushProfile() {
  if (!S.user || !S.profile) return;
  try {
    const { createdAt, ...rest } = S.profile; // createdAt immuable
    await updateDoc(doc(db, 'users', S.user.uid), rest);
    pushLeaderboard();
  } catch (e) { console.warn('flush', e); }
}
async function pushLeaderboard(force) {
  if (!S.user || !S.profile) return;
  const now = Date.now();
  if (!force && now - S.lastLbPush < 60000) return; // max 1/min
  S.lastLbPush = now;
  const nick = S.profile.nickname || S.profile.displayName || 'Étudiant';
  const payload = {
    xp: S.profile.xp || 0,
    nickname: nick.slice(0, 30),
    photoURL: S.profile.photoURL || '',
    updatedAt: serverTimestamp(),
  };
  try {
    await setDoc(doc(db, 'lb_weekly', isoWeekId(), 'users', S.user.uid), payload, { merge: true });
    await setDoc(doc(db, 'lb_alltime', 'users', S.user.uid), payload, { merge: true });
  } catch (e) { console.warn('leaderboard', e); }
}

/* XP & streak */
function addXp(n) {
  if (!S.profile || n <= 0) return;
  S.profile.xp = (S.profile.xp || 0) + n;
  scheduleFlush();
  touchStudy();
}
function touchStudy() {
  if (!S.profile) return;
  const t = todayStr();
  if (S.profile.lastStudyDay === t) return;
  S.profile.streak = (S.profile.lastStudyDay === yesterdayStr()) ? (S.profile.streak || 0) + 1 : 1;
  S.profile.lastStudyDay = t;
  scheduleFlush();
}

/* --------------------- topic progress (cloud) -------------------------- */
function tpDefault() { return { seen: [], starred: [], correct: 0, wrong: 0 }; }
async function getTP(topicId) {
  if (S.tpCache[topicId]) return S.tpCache[topicId];
  let data = tpDefault();
  if (S.user) {
    try {
      const snap = await getDoc(doc(db, 'users', S.user.uid, 'topics', topicId));
      if (snap.exists()) data = Object.assign(tpDefault(), snap.data());
    } catch (e) { console.warn('tp load', e); }
  }
  S.tpCache[topicId] = data;
  return data;
}
function saveTP(topicId) {
  clearTimeout(S.tpTimers[topicId]);
  S.tpTimers[topicId] = setTimeout(async () => {
    if (!S.user) return;
    try {
      const d = S.tpCache[topicId] || tpDefault();
      await setDoc(doc(db, 'users', S.user.uid, 'topics', topicId),
        { ...d, updatedAt: serverTimestamp() }, { merge: true });
    } catch (e) { console.warn('tp save', e); }
  }, 2000);
}
async function markSeen(topicId, cardIdx, discIdx) {
  const tp = await getTP(topicId);
  if (!tp.seen.includes(cardIdx)) {
    tp.seen.push(cardIdx);
    S.profile.cardsSeen = (S.profile.cardsSeen || 0) + 1;
    const k = String(discIdx);
    S.profile.discSeen = S.profile.discSeen || {};
    S.profile.discSeen[k] = (S.profile.discSeen[k] || 0) + 1;
    addXp(1); // +1 XP par carte découverte
    saveTP(topicId);
    scheduleFlush();
  }
}

/* ------------------------------ sessions ------------------------------- */
/* Limite : 2 appareils connectés simultanément par compte */
async function registerSession() {
  if (!S.user) return;
  S.sessionId = 's' + Math.random().toString(36).slice(2, 12);
  const col = collection(db, 'users', S.user.uid, 'sessions');
  try {
    await setDoc(doc(col, S.sessionId), { lastSeen: serverTimestamp(), ua: navigator.userAgent.slice(0, 120) });
    const snap = await getDocs(query(col, orderBy('lastSeen', 'desc')));
    const docs = snap.docs;
    for (let i = 2; i < docs.length; i++) await deleteDoc(docs[i].ref); // garde les 2 + récentes
  } catch (e) { console.warn('session', e); }
  clearInterval(S.heartbeat);
  S.heartbeat = setInterval(async () => {
    if (!S.user || !S.sessionId) return;
    try {
      const ref = doc(db, 'users', S.user.uid, 'sessions', S.sessionId);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        clearInterval(S.heartbeat);
        await signOut(auth);
        toast('Déconnecté : ce compte est utilisé sur un autre appareil.');
        location.hash = '#/login';
        return;
      }
      await updateDoc(ref, { lastSeen: serverTimestamp() });
    } catch (e) { /* offline : on réessaiera */ }
  }, 60000);
}
async function listSessions() {
  if (!S.user) return [];
  try {
    const snap = await getDocs(query(
      collection(db, 'users', S.user.uid, 'sessions'), orderBy('lastSeen', 'desc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { return []; }
}

/* ============================================================================
   PARTIE 2 — vues : login, accueil, discipline, cartes
   ============================================================================ */
const appEl = () => $('#app');
const tabbar = () => $('#tabbar');

function setTab(name) {
  tabbar().hidden = false;
  $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === name));
}
function hideTab() { tabbar().hidden = true; }

function waUnlockLink() {
  const txt = encodeURIComponent("Salut ! Je veux débloquer Flashcards FMPR Pro (50 MAD). Mon email de compte : ");
  return 'https://wa.me/' + WA_NUMBER + '?text=' + txt;
}

/* ------------------------------- LOGIN --------------------------------- */
function vLogin(err) {
  hideTab();
  appEl().innerHTML = `
    <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">🩺</div>
      <h1>Flashcards FMPR</h1>
      <p class="login-sub">8 260 flashcards · QCM · classement<br>Ta progression sauvegardée partout.</p>
      <button class="btn btn-google" id="gBtn">
        <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        <span>Continuer avec Google</span>
      </button>
      <div class="hr">ou par email</div>
      <label class="fld"><span>Email</span>
        <input class="input" id="email" type="email" placeholder="ton@email.com" autocomplete="email"></label>
      <label class="fld"><span>Mot de passe</span>
        <input class="input" id="pwd" type="password" placeholder="••••••••" autocomplete="current-password"></label>
      <div class="err" id="lerr"></div>
      <button class="btn btn-primary" id="eLogin">Se connecter</button>
      <button class="btn btn-ghost" id="eSignup">Créer un compte</button>
      <div style="text-align:center"><button class="linklike" id="eForgot">Mot de passe oublié ?</button></div>
      <div class="login-pro">✨ <b>Pro — 50 MAD</b> · tout débloqué, pour toujours.</div>
    </div>
    </div>`;
  const showErr = (m) => { const e = $('#lerr'); e.style.display = 'block'; e.textContent = m; };
  $('#gBtn').onclick = async () => {
    const btn = $('#gBtn');
    btn.disabled = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      // succès : onAuthStateChanged prend le relais et affiche l'accueil
    }
    catch (e) {
      const c = e.code || '';
      if (c.includes('popup-closed-by-user') || c.includes('cancelled-popup-request')) {
        showErr('Fenêtre Google fermée — réessaie.');
      } else if (c.includes('popup-blocked')) {
        showErr('Le navigateur a bloqué la fenêtre Google — autorise les popups pour ce site puis réessaie.');
      } else if (c.includes('account-exists-with-different-credential')) {
        showErr('Cet email a déjà un compte avec mot de passe — connecte-toi avec ton mot de passe.');
      } else {
        showErr('Connexion Google impossible : ' + e.message);
      }
    }
    btn.disabled = false;
  };
  const creds = () => {
    const email = $('#email').value.trim(), pwd = $('#pwd').value;
    if (!email || !pwd) { showErr('Entre ton email et ton mot de passe.'); return null; }
    return { email, pwd };
  };
  const friendly = (e) => {
    const c = e.code || '';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
      return 'Email ou mot de passe incorrect.';
    if (c.includes('email-already-in-use')) return 'Cet email a déjà un compte — connecte-toi.';
    if (c.includes('weak-password')) return 'Mot de passe trop court (6 caractères min).';
    if (c.includes('invalid-email')) return 'Email invalide.';
    return 'Erreur : ' + e.message;
  };
  $('#eLogin').onclick = async () => {
    const c = creds(); if (!c) return;
    try { await signInWithEmailAndPassword(auth, c.email, c.pwd); }
    catch (e) { showErr(friendly(e)); }
  };
  $('#eSignup').onclick = async () => {
    const c = creds(); if (!c) return;
    try { await createUserWithEmailAndPassword(auth, c.email, c.pwd); toast('Compte créé, bienvenue ! 🎉'); }
    catch (e) { showErr(friendly(e)); }
  };
  $('#eForgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) { showErr('Entre ton email pour recevoir le lien.'); return; }
    try { await sendPasswordResetEmail(auth, email); toast('Lien envoyé par email ✉️'); }
    catch (e) { showErr(friendly(e)); }
  };
  if (err) showErr(err);
}

/* ------------------------------- HOME ---------------------------------- */
async function vHome() {
  setTab('home');
  const idx = await loadIndex();
  const p = S.profile;
  const lvl = levelFor(p.xp || 0);
  const inLvl = (p.xp || 0) % 500;
  // charge la progression des disciplines (docs déjà en cache si visitées)
  const cards = await Promise.all(idx.map(async (d, i) => {
    const seen = (p.discSeen && p.discSeen[String(i)]) || 0;
    const pct = d.cards ? Math.min(100, Math.round(seen / d.cards * 100)) : 0;
    return `
      <button class="disc" data-go="#/d/${i}">
        <h3>${esc(d.name)}</h3>
        <small>${d.topics} sujets · ${d.cards.toLocaleString('fr-FR')} cartes</small>
        <div class="pbar"><div class="track"><div style="width:${pct}%"></div></div></div>
        <small>${pct}% vu</small>
      </button>`;
  }));
  appEl().innerHTML = `
    <div class="topbar">
      <h2>Salut ${esc((p.nickname || p.displayName || 'Doc').split(' ')[0])} 👋</h2>
      <div class="streak">🔥 ${p.streak || 0}</div>
    </div>
    <div class="xpbar">
      <div class="row"><b>Niveau ${lvl}</b><span>${(p.xp || 0).toLocaleString('fr-FR')} XP</span></div>
      <div class="track"><div style="width:${Math.round(inLvl / 500 * 100)}%"></div></div>
    </div>
    ${S.isPro ? '' : `
      <div class="demo-note">🎁 <b>Mode démo</b> — tu vois 5 cartes par sujet.
      <a href="#/profile" style="color:#0a5f66;font-weight:700">Débloque tout pour 50 MAD →</a></div>`}
    <div class="grid">${cards.join('')}</div>
    <p class="small mt" style="text-align:center">💡 Astuce : le mode QCM rapporte 10 XP par bonne réponse.</p>`;
  bindGo();
}

function bindGo(scope) {
  $$('[data-go]', scope).forEach(b => {
    b.onclick = (e) => { e.preventDefault(); location.hash = b.dataset.go; };
  });
}

/* ---------------------------- DISCIPLINE ------------------------------- */
async function vDisc(i) {
  setTab('home');
  const disc = await loadDisc(i);
  const idx = await loadIndex();
  const byChapter = {};
  for (const t of disc.topics) {
    const ch = t.chapter || 'Divers';
    (byChapter[ch] = byChapter[ch] || []).push(t);
  }
  let html = `<button class="back" data-go="#/home">← Disciplines</button>
    <div class="topbar"><h2>${DISC_EMOJI[i] || '📚'} ${esc(disc.name)}</h2></div>`;
  for (const [ch, topics] of Object.entries(byChapter)) {
    html += `<div class="chapter">${esc(ch)}</div>`;
    const rows = await Promise.all(topics.map(async (t) => {
      const tp = await getTP(t.id);
      const pct = t.cards.length ? Math.round(tp.seen.length / t.cards.length * 100) : 0;
      return `<button class="topic" data-go="#/t/${t.id}">
        <div><div class="t">${esc(t.topic)}</div><div class="c">${t.cards.length} cartes</div></div>
        <div class="pct">${pct}%</div>
      </button>`;
    }));
    html += rows.join('');
  }
  appEl().innerHTML = html;
  bindGo();
}

/* ------------------------------ FLIP MODE ------------------------------ */
async function vTopic(topicId) {
  setTab('home');
  await loadIndex();
  const entry = S.topicsById[topicId];
  if (!entry) { location.hash = '#/home'; return; }
  const { discIdx, topic } = entry;
  const tp = await getTP(topicId);

  // cartes : démo = 5 cartes fixes par utilisateur ; pro = tout
  let order;
  if (S.isPro) {
    order = topic.cards.map((_, i) => i);
  } else {
    const seed = hashStr(S.user.uid + ':' + topicId);
    order = seededPick(topic.cards.map((_, i) => i), DEMO_N, seed).sort((a, b) => a - b);
  }
  S.flip = { topicId, discIdx, topic, order, pos: 0, flipped: false, shuffled: false };

  appEl().innerHTML = `
    <button class="back" data-go="#/d/${discIdx}">← ${esc(S.index[discIdx].name)}</button>
    <div class="topbar"><h2 style="font-size:1.05rem">${esc(topic.topic)}</h2></div>
    ${S.isPro ? '' : `<div class="demo-note">🎁 <b>Démo :</b> ${order.length} cartes sur ${topic.cards.length}.
      <a href="#/profile" style="color:#0a5f66;font-weight:700">Tout débloquer (50 MAD) →</a></div>`}
    <div class="progress-line"><span id="fCount"></span><span id="fSeen"></span></div>
    <div class="fcard" id="fcard"><div id="ftext"></div><div class="hint" id="fhint"></div></div>
    <div class="star-row">
      <button class="iconbtn" id="fStar" title="Marquer">⭐</button>
      <button class="iconbtn" id="fShuffle" title="Mélanger">🔀</button>
    </div>
    <div class="fcard-nav">
      <button class="btn btn-ghost" id="fPrev">← Précédent</button>
      <button class="btn btn-primary" id="fNext">Suivant →</button>
    </div>`;
  $('#fcard').onclick = flipToggle;
  $('#fPrev').onclick = () => flipMove(-1);
  $('#fNext').onclick = () => flipMove(1);
  $('#fShuffle').onclick = () => {
    S.flip.order = shuffle(S.flip.order);
    S.flip.pos = 0; S.flip.flipped = false;
    renderFlip();
    toast('Mélangé 🔀');
  };
  $('#fStar').onclick = async () => {
    const f = S.flip, ci = f.order[f.pos];
    const tp2 = await getTP(f.topicId);
    const ix = tp2.starred.indexOf(ci);
    if (ix >= 0) tp2.starred.splice(ix, 1); else tp2.starred.push(ci);
    saveTP(f.topicId);
    renderFlip();
  };
  bindGo();
  renderFlip();
}

function renderFlip() {
  const f = S.flip;
  if (!f) return;
  const ci = f.order[f.pos];
  const card = f.topic.cards[ci];
  const box = $('#fcard');
  box.classList.toggle('flipped', f.flipped);
  $('#ftext').innerHTML = f.flipped
    ? `<div class="a">${esc(card.a)}</div>`
    : `<div class="q">${esc(card.q)}</div>`;
  $('#fhint').textContent = f.flipped ? 'Touche pour revoir la question' : 'Touche pour voir la réponse';
  $('#fCount').textContent = `Carte ${f.pos + 1}/${f.order.length}`;
  getTP(f.topicId).then(tp => {
    $('#fSeen').textContent = `${tp.seen.length}/${f.topic.cards.length} vues`;
    $('#fStar').classList.toggle('on', tp.starred.includes(ci));
  });
}
function flipToggle() {
  const f = S.flip;
  if (!f) return;
  f.flipped = !f.flipped;
  if (f.flipped) {
    const ci = f.order[f.pos];
    markSeen(f.topicId, ci, f.discIdx); // +1 XP la 1re fois
  }
  renderFlip();
}
function flipMove(d) {
  const f = S.flip;
  if (!f) return;
  f.pos = (f.pos + d + f.order.length) % f.order.length;
  f.flipped = false;
  renderFlip();
}

/* ============================================================================
   PARTIE 3 — QCM, classement
   ============================================================================ */
function lockHtml(feature) {
  return `<div class="lock">
    <div class="big">🔒</div>
    <h2>${feature} — Pro uniquement</h2>
    <p>Débloque les QCM, le classement et les 8 260 cartes pour <b>50 MAD</b>, paiement unique.</p>
    <a class="btn btn-primary" href="${waUnlockLink()}" target="_blank" rel="noopener"
       style="text-decoration:none">💬 Commander sur WhatsApp</a>
    <div class="hr">ou entre ton code d'activation</div>
    <div class="code-row">
      <input class="input" id="redeemInput" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off">
      <button class="btn btn-ghost" id="redeemBtn" style="width:auto;margin-top:0;flex:none">OK</button>
    </div>
  </div>`;
}
function bindRedeem() {
  const b = $('#redeemBtn');
  if (b) b.onclick = () => redeemCode($('#redeemInput').value);
}

/* --------------------------- MCQ ENGINE -------------------------------- */
function normAns(s) { return s.trim().toLowerCase().replace(/\s+/g, ' '); }

function buildQuiz(cards, n, fallbackAnswers, bankRows) {
  const order = shuffle(cards.map((_, i) => i)).slice(0, Math.min(n, cards.length));
  return order.map(ci => {
    const card = cards[ci];
    const seen = new Set([normAns(card.a)]);
    const distract = [];
    // 1) distracteurs pré-générés (plausibles, même catégorie) en priorité
    const bank = bankRows && bankRows[ci];
    if (bank) for (const d of shuffle([...bank])) {
      if (distract.length === 3) break;
      const k = normAns(d);
      if (k.length > 1 && !seen.has(k)) { seen.add(k); distract.push(d); }
    }
    // 2) repli : autres réponses du même sujet
    for (const c of shuffle(cards.filter((_, i) => i !== ci))) {
      if (distract.length === 3) break;
      const k = normAns(c.a);
      if (k.length > 1 && !seen.has(k)) { seen.add(k); distract.push(c.a); }
    }
    // 3) repli : pool global
    for (const a of shuffle(fallbackAnswers || [])) {
      if (distract.length === 3) break;
      const k = normAns(a);
      if (k.length > 1 && !seen.has(k)) { seen.add(k); distract.push(a); }
    }
    const options = shuffle([card.a, ...distract]);
    return { q: card.q, options, answer: options.indexOf(card.a), explain: card.a };
  });
}

/* ---------------------------- MCQ VIEWS -------------------------------- */
async function vMcqHome() {
  setTab('mcq');
  if (!S.isPro) { appEl().innerHTML = lockHtml('Mode QCM'); bindRedeem(); return; }
  const idx = await loadIndex();
  appEl().innerHTML = `
    <div class="topbar"><h2>✅ Mode QCM</h2></div>
    <p class="small">Des QCM générés à partir des cartes — comme à l'examen. <b>10 XP</b> par bonne réponse.</p>
    <button class="topic" data-go="#/mcq/mix">
      <div><div class="t">🎲 QCM mixte</div><div class="c">Toutes disciplines mélangées</div></div>
      <div class="pct">→</div>
    </button>
    <div class="chapter">Par sujet</div>
    ${idx.map((d, i) => `
      <button class="topic" data-go="#/mcqx/${i}">
        <div><div class="t">${DISC_EMOJI[i] || '📚'} ${esc(d.name)}</div><div class="c">${d.topics} sujets</div></div>
        <div class="pct">→</div>
      </button>`).join('')}`;
  bindGo();
}

async function vMcqTopics(i) {
  setTab('mcq');
  if (!S.isPro) { appEl().innerHTML = lockHtml('Mode QCM'); bindRedeem(); return; }
  const disc = await loadDisc(i);
  const byChapter = {};
  for (const t of disc.topics) (byChapter[t.chapter || 'Divers'] = byChapter[t.chapter || 'Divers'] || []).push(t);
  let html = `<button class="back" data-go="#/mcq">← QCM</button>
    <div class="topbar"><h2>Choisis un sujet</h2></div>`;
  for (const [ch, topics] of Object.entries(byChapter)) {
    html += `<div class="chapter">${esc(ch)}</div>` + topics.map(t => `
      <button class="topic" data-go="#/mcq/t/${t.id}">
        <div><div class="t">${esc(t.topic)}</div><div class="c">${t.cards.length} cartes</div></div>
        <div class="pct">→</div>
      </button>`).join('');
  }
  appEl().innerHTML = html;
  bindGo();
}

async function vMcqSetup(kind, id) {
  setTab('mcq');
  if (!S.isPro) { appEl().innerHTML = lockHtml('Mode QCM'); bindRedeem(); return; }
  let title = '';
  if (kind === 'topic') {
    const e = S.topicsById[id] || await (async () => { await loadAllDiscs(); return S.topicsById[id]; })();
    if (!e) { location.hash = '#/mcq'; return; }
    title = e.topic.topic;
  } else title = 'QCM mixte — toutes disciplines';
  appEl().innerHTML = `
    <button class="back" data-go="#/mcq">← QCM</button>
    <div class="mcq-setup">
      <h3 style="margin:0 0 4px">${esc(title)}</h3>
      <p class="small">Combien de questions ?</p>
      <div class="quizpick">
        ${[10, 20, 30, 50].map(n => `<button class="btn btn-ghost" data-n="${n}">${n} questions</button>`).join('')}
      </div>
    </div>`;
  $$('[data-n]').forEach(b => b.onclick = () => startQuiz(kind, id, +b.dataset.n, title));
  bindGo();
}

async function startQuiz(kind, id, n, title) {
  toast('Préparation du QCM…');
  let questions;
  if (kind === 'topic') {
    const { discIdx, topic } = S.topicsById[id];
    const disc = await loadDisc(discIdx);
    const pool = [];
    for (const t of disc.topics) for (const c of t.cards) pool.push(c.a);
    const bank = await loadMcqBank(discIdx);
    const rows = bank && bank[id];
    const bankRows = rows ? topic.cards.map((_, i) => rows[i] || null) : null;
    questions = buildQuiz(topic.cards, n, pool, bankRows).filter(q => q.options.length >= 2);
    S.quiz = { questions, pos: 0, correct: 0, title, kind, topicId: id, discIdx };
  } else {
    await loadAllDiscs();
    const all = [];
    for (const [di, disc] of Object.entries(S.discs))
      for (const t of disc.topics) t.cards.forEach((c, ci) => all.push({ ...c, di: +di, topicId: t.id, cardIdx: ci }));
    const picked = shuffle(all).slice(0, Math.min(n, all.length));
    const banks = {};
    for (const di of [...new Set(picked.map(c => c.di))]) banks[di] = await loadMcqBank(di);
    const globalPool = all.map(c => c.a);
    questions = picked.map(card => {
      const b = banks[card.di];
      const rows = b && b[card.topicId];
      const bankRows = rows && rows[card.cardIdx] ? [rows[card.cardIdx]] : null;
      const q = buildQuiz([{ q: card.q, a: card.a }], 1, shuffle(globalPool).slice(0, 400), bankRows)[0];
      return q;
    }).filter(q => q && q.options.length >= 2);
    S.quiz = { questions, pos: 0, correct: 0, title, kind };
  }
  if (!questions.length) { toast('Pas assez de cartes pour ce QCM.'); return; }
  location.hash = '#/quiz';
}

function vQuiz() {
  setTab('mcq');
  const Q = S.quiz;
  if (!Q || !Q.questions.length) { location.hash = '#/mcq'; return; }
  if (Q.pos >= Q.questions.length) return vQuizResult();
  const q = Q.questions[Q.pos];
  appEl().innerHTML = `
    <div class="progress-line"><span>Question ${Q.pos + 1}/${Q.questions.length}</span><span>✅ ${Q.correct}</span></div>
    <div class="track" style="margin-bottom:14px"><div style="width:${Math.round(Q.pos / Q.questions.length * 100)}%"></div></div>
    <div class="mcq-q">${esc(q.q)}</div>
    <div id="opts">${q.options.map((o, i) => `
      <button class="opt" data-i="${i}"><span class="letter">${'ABCD'[i] || i + 1}</span>${esc(o)}</button>`).join('')}
    </div>
    <div id="after" style="display:none">
      <div class="mcq-explain" id="expl"></div>
      <button class="btn btn-primary" id="qNext">${Q.pos + 1 === Q.questions.length ? 'Voir mon score 🏁' : 'Question suivante →'}</button>
      <button class="linklike" id="qQuit" style="display:block;margin:8px auto">Abandonner</button>
    </div>`;
  $$('#opts .opt').forEach(b => b.onclick = () => answerQuiz(+b.dataset.i));
  $('#qNext').onclick = () => { Q.pos++; vQuiz(); };
  $('#qQuit').onclick = () => { S.quiz = null; location.hash = '#/mcq'; };
}

function answerQuiz(i) {
  const Q = S.quiz;
  const q = Q.questions[Q.pos];
  const good = i === q.answer;
  if (good) Q.correct++;
  $$('#opts .opt').forEach(b => {
    b.disabled = true;
    const bi = +b.dataset.i;
    if (bi === q.answer) b.classList.add('correct');
    else if (bi === i) b.classList.add('wrong');
  });
  $('#expl').innerHTML = (good ? '✅ <b>Bonne réponse !</b><br>' : '❌ <b>Raté.</b><br>') +
    'Bonne réponse : ' + esc(q.explain);
  $('#after').style.display = 'block';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function vQuizResult() {
  setTab('mcq');
  const Q = S.quiz;
  const n = Q.questions.length, c = Q.correct;
  const pct = Math.round(c / n * 100);
  const xp = c * 10 + (pct >= 80 ? 20 : 0);
  // sauvegarde (une seule fois)
  if (!Q.saved) {
    Q.saved = true;
    S.profile.mcqTotal = (S.profile.mcqTotal || 0) + n;
    S.profile.mcqCorrect = (S.profile.mcqCorrect || 0) + c;
    if (Q.kind === 'topic') {
      const tp = await getTP(Q.topicId);
      tp.correct += c; tp.wrong += (n - c);
      saveTP(Q.topicId);
    }
    addXp(xp);
    pushLeaderboard(true);
    touchStudy();
  }
  const msg = pct >= 80 ? 'Excellent travail ! 🌟' : pct >= 50 ? 'Bien, encore un effort 💪' : 'Revois les cartes et reviens plus fort 📚';
  appEl().innerHTML = `
    <div class="result">
      <div style="font-size:3rem">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}</div>
      <h2 style="margin:8px 0">${esc(Q.title)}</h2>
      <div class="score">${c}/${n}</div>
      <p><b>${pct}%</b> de bonnes réponses · <b style="color:var(--teal)">+${xp} XP</b></p>
      <p class="small">${msg}</p>
      <button class="btn btn-primary" id="rAgain">🔁 Rejouer</button>
      <button class="btn btn-ghost" data-go="#/mcq">Choisir un autre QCM</button>
      <button class="btn btn-ghost" data-go="#/home">Accueil</button>
    </div>`;
  $('#rAgain').onclick = () => startQuiz(Q.kind, Q.topicId, n, Q.title);
  bindGo();
}

/* --------------------------- LEADERBOARD ------------------------------- */
async function vLeaderboard() {
  setTab('leaderboard');
  if (!S.isPro) { appEl().innerHTML = lockHtml('Classement'); bindRedeem(); return; }
  const tab = S.lbTab;
  appEl().innerHTML = `
    <div class="topbar"><h2>🏆 Classement</h2></div>
    ${!S.profile.nickname ? `
      <div class="demo-note">👋 Choisis ton pseudo pour apparaître dans le classement :
        <div class="code-row"><input class="input" id="nickInput" placeholder="Pseudo" maxlength="30">
        <button class="btn btn-ghost" id="nickBtn" style="width:auto;margin-top:0;flex:none">OK</button></div>
      </div>` : ''}
    <div class="tabs">
      <button data-t="weekly" class="${tab === 'weekly' ? 'on' : ''}">Cette semaine</button>
      <button data-t="alltime" class="${tab === 'alltime' ? 'on' : ''}">Tout temps</button>
    </div>
    <div id="lbList"><div class="empty">Chargement…</div></div>
    <p class="small" style="text-align:center">Gagne de l'XP : QCM (10 XP/bonne réponse), cartes étudiées (1 XP/carte).</p>`;
  $$('.tabs button').forEach(b => b.onclick = () => { S.lbTab = b.dataset.t; vLeaderboard(); });
  const nb = $('#nickBtn');
  if (nb) nb.onclick = async () => {
    const v = $('#nickInput').value.trim().slice(0, 30);
    if (!v) return;
    await saveProfile({ nickname: v });
    pushLeaderboard(true);
    toast('Pseudo enregistré ✅');
    vLeaderboard();
  };
  await renderLb();
}

async function renderLb() {
  const list = $('#lbList');
  try {
    const colRef = tabCol();
    const snap = await getDocs(query(colRef, orderBy('xp', 'desc'), limit(50)));
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    if (!rows.length) {
      list.innerHTML = `<div class="empty">Personne pour l'instant.<br>Sois le premier à gagner de l'XP ! 🚀</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = rows.map((r, i) => `
      <div class="lb-row ${r.uid === S.user.uid ? 'me' : ''}">
        <div class="lb-rank">${medals[i] || (i + 1)}</div>
        <div class="avatar">${r.photoURL ? `<img src="${esc(r.photoURL)}" alt="">` : esc((r.nickname || '?')[0].toUpperCase())}</div>
        <div class="lb-name">${esc(r.nickname || 'Étudiant')}${r.uid === S.user.uid ? ' (toi)' : ''}</div>
        <div class="lb-xp">${(r.xp || 0).toLocaleString('fr-FR')} XP</div>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty">Classement indisponible hors-ligne.<br>Reconnecte-toi pour le voir. 📶</div>`;
  }
}
function tabCol() {
  if (S.lbTab === 'weekly') return collection(db, 'lb_weekly', isoWeekId(), 'users');
  return collection(db, 'lb_alltime', 'users');
}

/* ============================================================================
   PARTIE 4 — plan de révision, profil, activation, routeur
   ============================================================================ */

/* ------------------------------ PLAN ----------------------------------- */
async function getPlanState() {
  if (S.planState) return S.planState;
  const ref = doc(db, 'users', S.user.uid, 'meta', 'plan');
  const snap = await getDoc(ref);
  if (snap.exists()) {
    S.planState = snap.data();
  } else {
    S.planState = { startDate: todayStr(), checks: {} };
    try { await setDoc(ref, S.planState); } catch (e) { /* offline */ }
  }
  return S.planState;
}
function savePlanState() {
  clearTimeout(S.planTimer);
  S.planTimer = setTimeout(async () => {
    try {
      await setDoc(doc(db, 'users', S.user.uid, 'meta', 'plan'), S.planState, { merge: true });
    } catch (e) { console.warn('plan save', e); }
  }, 1500);
}
function weekDates(startDate, n) {
  const d = new Date(startDate + 'T12:00:00');
  d.setDate(d.getDate() + (n - 1) * 7);
  const e = new Date(d); e.setDate(e.getDate() + 6);
  const f = (x) => x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return f(d) + ' → ' + f(e);
}

async function vPlan() {
  setTab('plan');
  if (!S.isPro) { appEl().innerHTML = lockHtml('Plan de révision'); bindRedeem(); return; }
  const plan = await loadPlan();
  const st = await getPlanState();
  const totalTasks = plan.reduce((a, w) => a + w.tasks.length, 0);
  const doneTasks = Object.values(st.checks || {}).flat().filter(Boolean).length;
  const pct = totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0;

  let html = `
    <div class="topbar"><h2>🗓️ Plan 32 semaines</h2></div>
    <div class="xpbar">
      <div class="row"><b>${doneTasks}/${totalTasks} tâches</b><span>${pct}%</span></div>
      <div class="track"><div style="width:${pct}%"></div></div>
    </div>
    <div class="kv"><div class="r"><span class="k">Début du plan</span>
      <span class="v"><input type="date" id="planStart" value="${esc(st.startDate || '')}" class="input" style="margin:0;padding:6px 8px;width:auto"></span></div>
    </div>`;
  for (const w of plan) {
    const checks = (st.checks && st.checks[String(w.n)]) || [];
    const done = checks.filter(Boolean).length;
    const open = S.openWeek === w.n;
    html += `
    <div class="week">
      <button class="week-head" data-w="${w.n}">
        <div><span class="phase">${esc(w.phase)}</span>
          <h3>S${w.n} — ${esc(w.title)}</h3>
          <small>${esc(weekDates(st.startDate, w.n))} · ${done}/${w.tasks.length} ✓</small></div>
        <div style="font-size:1.2rem">${open ? '▾' : '▸'}</div>
      </button>
      ${open ? `
        <p class="small" style="margin:10px 0 4px"><b>Focus :</b> ${esc(w.focus || '')}</p>
        ${w.milestone ? `<p class="small" style="color:var(--teal);font-weight:700">🎯 ${esc(w.milestone)}</p>` : ''}
        <div>${w.tasks.map((t, ti) => `
          <label class="task ${checks[ti] ? 'done' : ''}">
            <input type="checkbox" data-wn="${w.n}" data-ti="${ti}" ${checks[ti] ? 'checked' : ''}>
            <span>${esc(t)}</span>
          </label>`).join('')}
        </div>` : ''}
    </div>`;
  }
  html += `
    <button class="btn btn-ghost mt" id="planReset">Réinitialiser le plan</button>
    <p class="small" style="text-align:center">Ta progression du plan est sauvegardée sur ton compte.</p>`;
  appEl().innerHTML = html;

  $$('.week-head').forEach(b => b.onclick = () => {
    S.openWeek = S.openWeek === +b.dataset.w ? null : +b.dataset.w;
    vPlan();
  });
  $$('.task input').forEach(cb => cb.onchange = async () => {
    const st2 = await getPlanState();
    const wn = cb.dataset.wn;
    st2.checks[wn] = st2.checks[wn] || [];
    st2.checks[wn][+cb.dataset.ti] = cb.checked;
    savePlanState();
    cb.closest('.task').classList.toggle('done', cb.checked);
    touchStudy();
  });
  $('#planStart').onchange = async (e) => {
    const st2 = await getPlanState();
    st2.startDate = e.target.value;
    savePlanState();
    vPlan();
  };
  const rst = $('#planReset');
  rst.onclick = () => {
    if (!rst.dataset.armed) {
      rst.dataset.armed = '1';
      rst.textContent = 'Touche encore pour confirmer la réinitialisation';
      setTimeout(() => { rst.dataset.armed = ''; rst.textContent = 'Réinitialiser le plan'; }, 4000);
    } else {
      S.planState = { startDate: todayStr(), checks: {} };
      savePlanState();
      toast('Plan réinitialisé 🗓️');
      vPlan();
    }
  };
}

/* ----------------------------- PROFILE --------------------------------- */
async function vProfile() {
  setTab('profile');
  const p = S.profile;
  const acc = p.mcqTotal ? Math.round(p.mcqCorrect / p.mcqTotal * 100) : 0;
  const lvl = levelFor(p.xp || 0);
  appEl().innerHTML = `
    <div class="topbar"><h2>👤 Profil</h2></div>
    <div class="kv">
      <div class="r"><span class="k">Compte</span><span class="v">${esc(p.displayName || '')}</span></div>
      <div class="r"><span class="k">Email</span><span class="v" style="font-size:.8rem">${esc(p.email || '')}</span></div>
      <div class="r"><span class="k">Statut</span><span class="v">${p.isPro ? '<span class="badge">⭐ PRO</span>' : 'Démo'}</span></div>
      <div class="r"><span class="k">Pseudo (classement)</span>
        <span class="v"><a href="#/leaderboard" style="color:var(--teal)">${esc(p.nickname || 'définir →')}</a></span></div>
    </div>
    <div class="kv">
      <div class="r"><span class="k">Niveau</span><span class="v">${lvl} (${(p.xp || 0).toLocaleString('fr-FR')} XP)</span></div>
      <div class="r"><span class="k">🔥 Série</span><span class="v">${p.streak || 0} jour(s)</span></div>
      <div class="r"><span class="k">🃏 Cartes vues</span><span class="v">${(p.cardsSeen || 0).toLocaleString('fr-FR')}</span></div>
      <div class="r"><span class="k">✅ QCM</span><span class="v">${p.mcqCorrect || 0}/${p.mcqTotal || 0} (${acc}%)</span></div>
    </div>
    ${p.isPro ? '' : `
    <div class="lock" style="margin-top:0">
      <div class="big">🚀</div>
      <h2>Passe en Pro — 50 MAD</h2>
      <p>8 260 cartes · QCM illimités · classement · plan synchronisé.<br>Paiement unique, à vie.</p>
      <a class="btn btn-primary" href="${waUnlockLink()}" target="_blank" rel="noopener" style="text-decoration:none">💬 Commander sur WhatsApp</a>
      <div class="hr">ou entre ton code d'activation</div>
      <div class="code-row">
        <input class="input" id="redeemInput" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off">
        <button class="btn btn-ghost" id="redeemBtn" style="width:auto;margin-top:0;flex:none">OK</button>
      </div>
    </div>`}
    <div class="kv mt">
      <div class="r"><span class="k"><b>📱 Mes appareils</b></span><span class="v small">max 2 connectés</span></div>
      <div id="sessList"><div class="small">Chargement…</div></div>
    </div>
    <button class="btn btn-ghost" id="signout">Se déconnecter</button>`;

  bindRedeem();
  $('#signout').onclick = async () => {
    clearInterval(S.heartbeat);
    try { if (S.sessionId) await deleteDoc(doc(db, 'users', S.user.uid, 'sessions', S.sessionId)); } catch (e) {}
    await signOut(auth);
  };
  // sessions
  const sessions = await listSessions();
  $('#sessList').innerHTML = sessions.length ? sessions.map(s => {
    const me = s.id === S.sessionId;
    const when = s.lastSeen && s.lastSeen.toDate ? s.lastSeen.toDate().toLocaleString('fr-FR') : '…';
    return `<div class="r"><span class="k" style="font-size:.78rem">${me ? '📱 Cet appareil' : '📲 Appareil'}<br><span class="small">${esc(when)}</span></span>
      <span class="v">${me ? '' : `<button class="linklike" data-rev="${s.id}">déconnecter</button>`}</span></div>`;
  }).join('') : '<div class="small">Aucun appareil.</div>';
  $$('[data-rev]').forEach(b => b.onclick = async () => {
    await deleteDoc(doc(db, 'users', S.user.uid, 'sessions', b.dataset.rev));
    toast('Appareil déconnecté.');
    vProfile();
  });
}

/* ------------------------------ REDEEM --------------------------------- */
/* Code = HMAC-SHA256(secret, "FMPR2:"+serial) → 16 caractères affichés.
   Seule l'empreinte SHA-256 du code est stockée (collection "codes").
   La réclamation est atomique (transaction) + à usage unique. */
async function redeemCode(raw) {
  const code = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 16) { toast('Code invalide : vérifie le format XXXX-XXXX-XXXX-XXXX.'); return; }
  toast('Vérification du code…');
  let h;
  try { h = await sha256hex(code); } catch (e) { toast('Erreur technique, réessaie.'); return; }
  // Un seul filtre d'égalité → pas d'index composite nécessaire.
  const snap = await getDocs(query(collection(db, 'codes'), where('codeHash', '==', h), limit(5)));
  const target = snap.docs.find(d => !d.data().used);
  if (!target) { toast('Code invalide ou déjà utilisé.'); return; }
  const codeRef = target.ref;
  try {
    await runTransaction(db, async (tx) => {
      const s = await tx.get(codeRef);
      if (!s.exists() || s.data().used) throw new Error('already-used');
      tx.update(codeRef, { used: true, usedBy: S.user.uid, usedAt: serverTimestamp() });
    });
  } catch (e) { toast('Ce code vient d\'être utilisé.'); return; }
  try {
    await setDoc(doc(db, 'claims', S.user.uid), { serial: target.id, at: serverTimestamp() });
    await updateDoc(doc(db, 'users', S.user.uid), { isPro: true, proSince: serverTimestamp() });
  } catch (e) { toast('Erreur d\'activation — contacte-nous sur WhatsApp.'); return; }
  S.profile.isPro = true;
  S.isPro = true;
  toast('🎉 Version Pro activée ! Bonnes révisions !');
  render();
}

/* --------------------------- SETUP (dev) ------------------------------- */
function vSetup() {
  hideTab();
  appEl().innerHTML = `
    <div class="login-card">
      <h1>🔧 Configuration requise</h1>
      <p>Ce site a besoin d'un projet Firebase pour fonctionner :</p>
      <p class="small" style="text-align:left">
        1. Crée un projet sur <b>console.firebase.google.com</b><br>
        2. Ajoute une application <b>Web</b> → copie la config<br>
        3. Colle-la dans <b>firebase-config.js</b><br>
        4. Active <b>Authentication</b> → Google + Email/mot de passe<br>
        5. Crée une base <b>Firestore</b> (mode production)<br>
        6. Publie les règles de <b>firestore.rules</b> (pense à mettre ton email admin)
      </p>
    </div>`;
}

/* ------------------------------ ROUTER --------------------------------- */
function render() {
  const h = location.hash || '#/home';
  if (!CONFIG_OK) { vSetup(); return; }
  if (!S.user) {
    if (h !== '#/login') { location.hash = '#/login'; return; }
    vLogin(); return;
  }
  const routes = [
    [/^#\/login$/, () => { location.hash = '#/home'; }],
    [/^#\/home$/, vHome],
    [/^#\/d\/(\d+)$/, m => vDisc(+m[1])],
    [/^#\/t\/([\w-]+)$/, m => vTopic(m[1])],
    [/^#\/mcq$/, vMcqHome],
    [/^#\/mcqx\/(\d+)$/, m => vMcqTopics(+m[1])],
    [/^#\/mcq\/t\/([\w-]+)$/, m => vMcqSetup('topic', m[1])],
    [/^#\/mcq\/mix$/, () => vMcqSetup('mix')],
    [/^#\/quiz$/, vQuiz],
    [/^#\/leaderboard$/, vLeaderboard],
    [/^#\/plan$/, vPlan],
    [/^#\/profile$/, vProfile],
  ];
  for (const [re, fn] of routes) {
    const m = h.match(re);
    if (m) { fn(m); return; }
  }
  location.hash = '#/home';
}
window.addEventListener('hashchange', render);

/* -------------------------------- BOOT --------------------------------- */
async function boot() {
  if (!CONFIG_OK) { vSetup(); return; }
  let redirectErr = null;
  try { await getRedirectResult(auth); }
  catch (e) { redirectErr = e.code === 'auth/account-exists-with-different-credential'
    ? 'Cet email a déjà un compte avec une autre méthode — connecte-toi avec elle.'
    : 'Connexion impossible : ' + e.message; }
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      S.user = user;
      try {
        await ensureProfile(user);
      } catch (e) {
        console.error(e);
        vLogin('Erreur de connexion à la base de données. Réessaie.');
        return;
      }
      registerSession();
      if (!location.hash || location.hash === '#/login') location.hash = '#/home';
      else render();
    } else {
      S.user = null; S.profile = null; S.isPro = false;
      S.tpCache = {}; S.planState = null;
      clearInterval(S.heartbeat);
      if (location.hash !== '#/login') location.hash = '#/login';
      vLogin(redirectErr);
      redirectErr = null;
    }
  });
}
boot();
