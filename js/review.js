/* ============================================================================
   Révision espacée — page de session (review.html).
   Pro uniquement (guardPro, comme le Plan). Reprend la carte flip de
   topic.js (même markup / mêmes classes styles.css) + 4 boutons de
   notation avec le délai affiché sous chacun.
   ============================================================================ */
import {
  requireAuth, guardPro, loadDisc, loadIndex, getTP, markSeen,
  addXp, tabbar, toast, esc, shuffle,
} from './common.js';
import {
  GRADES, GRADE_LABELS, nextState, intervalLabel, parseKey, makeKey,
} from './sr-scheduler.js';
import {
  loadSR, saveSR, gradeCard, getDueQueue, SESSION_SIZE, NEW_PER_DAY,
} from './sr.js';

if (!guardPro('Révision espacée', 'home')) throw new Error('locked');

const authP = requireAuth();
const $ = (s) => document.querySelector(s);

/* ------------------------------ état ------------------------------------ */
const S = {
  queue: [],        // clés "d{disc}:{topicId}:{ci}" à réviser
  pos: 0,
  flipped: false,
  current: null,    // {key, discIdx, topicId, cardIdx, q, a, discName, topicName}
  againCount: {},   // Encore : réapparitions dans cette session (max 2)
  done: 0,          // cartes notées dans cette session
  masteredNow: 0,
  mode: 'due',      // 'due' | 'new'
};

/* --------------------------- chargement --------------------------------- */
async function loadCardText(key) {
  const p = parseKey(key);
  if (!p) return null;
  const disc = await loadDisc(p.discIdx);
  const topic = disc.topics.find((t) => t.id === p.topicId);
  if (!topic || !topic.cards[p.cardIdx]) return null;
  const idx = await loadIndex();
  return {
    key, ...p,
    q: topic.cards[p.cardIdx].q,
    a: topic.cards[p.cardIdx].a,
    discName: idx[p.discIdx] ? idx[p.discIdx].name : '',
    topicName: topic.topic || topic.t || '',
  };
}

async function buildQueue() {
  const due = getDueQueue().slice(0, SESSION_SIZE);
  S.queue = due;
  S.pos = 0;
  S.done = 0;
  S.masteredNow = 0;
  S.mode = 'due';
}

async function pickNewCards() {
  /* Nouvelles cartes : 10 max, d'une discipline choisie, d'abord les sujets
     déjà commencés (seen > 0), sinon les premiers sujets de la discipline. */
  const idx = await loadIndex();
  const sel = document.getElementById('newDisc');
  const d = parseInt(sel ? sel.value : '1', 10);
  const disc = await loadDisc(d);
  const st = loadSR();
  const fresh = [];
  for (const t of disc.topics) {
    if (fresh.length >= NEW_PER_DAY) break;
    let seen = [];
    try { seen = (await getTP(t.id)).seen || []; } catch (e) { seen = []; }
    const candidates = [];
    for (let ci = 0; ci < t.cards.length; ci++) {
      const key = makeKey(d, t.id, ci);
      if (!st.cards[key]) candidates.push(ci);
    }
    if (!candidates.length) continue;
    /* Priorité aux cartes déjà vues en étude libre. */
    candidates.sort((a, b) => (seen.includes(b) ? 1 : 0) - (seen.includes(a) ? 1 : 0));
    for (const ci of candidates.slice(0, NEW_PER_DAY - fresh.length)) {
      fresh.push(makeKey(d, t.id, ci));
    }
  }
  if (!fresh.length) {
    toast('Plus de nouvelles cartes dans cette discipline.');
    return;
  }
  S.queue = shuffle(fresh);
  S.pos = 0;
  S.done = 0;
  S.mode = 'new';
  showCurrent();
}

/* ---------------------------- affichage --------------------------------- */
function renderShell() {
  if (!document.getElementById('srReviewStyle')) {
    const st = document.createElement('style');
    st.id = 'srReviewStyle';
    st.textContent = `
/* Boutons de notation + méta-carte (variables du thème : clair/sombre). */
.grade{display:flex;gap:8px;margin:14px 0}
.grade button{flex:1;border:none;border-radius:12px;padding:12px 4px;font-family:inherit;
  cursor:pointer;background:var(--surface);box-shadow:var(--shadow2)}
.grade button b{display:block;font-size:13px;color:var(--ink)}
.grade button span{display:block;font-size:11px;color:var(--muted);margin-top:3px}
.grade button.g1 b{color:var(--red)}
.grade button.g4 b{color:var(--teal)}
.fcard-meta{display:flex;justify-content:space-between;font-size:12px;color:var(--muted);margin:8px 2px 0}`;
    document.head.appendChild(st);
  }
  $('#app').innerHTML = `
  <div class="topbar">
    <h2>Révision espacée</h2>
    <div class="streak" id="srCount"></div>
  </div>
  <div class="hello-sub" id="srSub"></div>
  <div id="srBody"></div>
  <div id="newSlot"></div>`;
  document.body.insertAdjacentHTML('beforeend', tabbar('home'));
}

function renderCard() {
  const c = S.current;
  $('#srBody').innerHTML = `
  <div class="fcard" id="fcard">
    <div class="fcard-face" id="fFront"><div class="q" id="fQ"></div>
      <div class="hint" id="fHintQ">Touche pour voir la réponse</div></div>
    <div class="fcard-face" id="fBack" hidden><div class="a" id="fA"></div>
      <div class="hint" id="fHintA">Touche pour revoir la question</div></div>
  </div>
  <div class="fcard-meta"><span id="fTopic"></span><span id="fSeen"></span></div>
  <div class="grade" id="gradeRow" hidden>
    ${[1, 2, 3, 4].map((g) => {
      const st = loadSR().cards[c.key] || null;
      return `<button data-g="${g}" class="${g === 1 ? 'g1' : g === 4 ? 'g4' : ''}">
        <b>${GRADE_LABELS[g]}</b><span>${esc(intervalLabel(st, g))}</span></button>`;
    }).join('')}
  </div>
  <div class="fcard-nav">
    <button class="btn btn-ghost" id="srQuit">Quitter</button>
    <button class="btn btn-primary" id="srNext" hidden>Carte suivante →</button>
  </div>`;
  $('#fQ').textContent = c.q;
  $('#fA').textContent = c.a;
  $('#fTopic').textContent = `${c.discName} · ${c.topicName}`;
  $('#srCount').textContent = `Carte ${S.pos + 1}/${S.queue.length}`;
  $('#srSub').textContent = S.mode === 'new'
    ? 'Nouvelles cartes — note chaque carte pour la programmer.'
    : 'Cartes dues — note chaque carte pour programmer la prochaine révision.';
  $('#fcard').onclick = () => {
    S.flipped = !S.flipped;
    $('#fcard').classList.toggle('flipped', S.flipped);
    $('#fFront').hidden = S.flipped;
    $('#fBack').hidden = !S.flipped;
    $('#gradeRow').hidden = !S.flipped;
  };
  document.querySelectorAll('#gradeRow button').forEach((b) => {
    b.onclick = () => onGrade(parseInt(b.dataset.g, 10));
  });
  $('#srQuit').onclick = () => { location.href = 'home.html'; };
  const nx = $('#srNext');
  if (nx) nx.onclick = () => { S.pos += 1; showCurrent(); };
}

function renderEmpty() {
  const remaining = getDueQueue().length;
  $('#srBody').innerHTML = `
  <div class="card" style="text-align:center;padding:28px 18px">
    <h2 style="color:#0e2a44">${S.done ? 'Session terminée' : 'Rien à réviser'}</h2>
    <p class="small" style="margin-top:8px;line-height:1.6">
      ${S.done
        ? `${S.done} carte${S.done > 1 ? 's' : ''} révisée${S.done > 1 ? 's' : ''} · ${S.masteredNow} maîtrisée${S.masteredNow > 1 ? 's' : ''} maintenant.`
        : 'Aucune carte due pour l\'instant. Reviens plus tard, ou ajoute des nouvelles cartes ci-dessous.'}
    </p>
    ${remaining > 0 ? `<button class="btn btn-primary" id="srMore" style="margin-top:14px">Continuer (${remaining} restantes)</button>` : ''}
    <a class="btn btn-ghost" href="home.html" style="display:block;text-decoration:none;text-align:center;margin-top:10px">Retour à l'accueil</a>
  </div>`;
  const more = $('#srMore');
  if (more) more.onclick = async () => { await buildQueue(); showCurrent(); };
}

function renderNewPicker() {
  loadIndex().then((idx) => {
    const el = $('#newSlot');
    if (!el) return;
    el.innerHTML = `
    <div class="card" style="margin-top:14px">
      <h2 style="color:#0e2a44;font-size:17px">Nouvelles cartes</h2>
      <p class="small" style="margin:6px 0 10px;line-height:1.5">Ajoute jusqu'à ${NEW_PER_DAY} nouvelles cartes par jour à ta révision espacée.</p>
      <div style="display:flex;gap:8px">
        <select id="newDisc" class="input" style="flex:1">${idx.map((d, i) =>
          `<option value="${i}">${esc(d.name)}</option>`).join('')}</select>
        <button class="btn btn-primary" id="newGo" style="flex:none">Ajouter</button>
      </div>
    </div>`;
    $('#newGo').onclick = pickNewCards;
  });
}

async function showCurrent() {
  S.flipped = false;
  if (S.pos >= S.queue.length) {
    renderEmpty();
    renderNewPicker();
    return;
  }
  const key = S.queue[S.pos];
  const c = await loadCardText(key);
  if (!c) { S.pos += 1; showCurrent(); return; }
  S.current = c;
  renderCard();
}

function onGrade(g) {
  const c = S.current;
  if (!c) return;
  const isNew = !loadSR().cards[c.key];
  const ns = gradeCard(c.key, g);
  if (isNew) markSeen(c.topicId, c.cardIdx, c.discIdx).catch(() => {});
  addXp(1);
  S.done += 1;
  if (ns[1] >= 21) S.masteredNow += 1;
  if (g === GRADES.AGAIN) {
    /* Encore : la carte revient à la fin de cette session (max 2 fois). */
    const n = (S.againCount[c.key] || 0) + 1;
    S.againCount[c.key] = n;
    if (n <= 2) S.queue.push(c.key);
  }
  S.pos += 1;
  showCurrent();
}

/* ---------------------------- démarrage --------------------------------- */
renderShell();
authP.then(async () => {
  await buildQueue();
  renderNewPicker();
  showCurrent();
}).catch(() => {});
