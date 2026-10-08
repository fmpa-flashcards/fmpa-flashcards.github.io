/* Quiz UM6SS : cas cliniques progressifs (admission définitive) et banques de
   100 QCM (admissibilité).
   URL : um6ss-quiz.html?case=urg-med  ou  um6ss-quiz.html?bank=anat
   QCM multi-réponses comme à l'examen (cases à cocher, correction détaillée). */
import {
  requireAuth, profile, guardFull, shuffle, esc, qp, tabbar,
  addXp, saveProfile, pushLeaderboard, touchStudy,
} from './common.js';

await requireAuth();
if (!guardFull('UM6SS', 'um6ss')) throw new Error('locked');

const app = document.getElementById('app');
const caseId = qp('case', '');
const bankId = qp('bank', '');

let title = 'QCM UM6SS';
let intro = null;       // scénario du cas (admission : cas progressif)
let questions = [];     // {q, options[5], explain[5], correct:Set, reveal?}
let isCase = false;

function prep(m) {
  const order = shuffle([0, 1, 2, 3, 4]);
  const correct = new Set();
  order.forEach((orig, i) => { if (m.correct.includes(orig)) correct.add(i); });
  return {
    q: m.q,
    options: order.map(i => m.options[i]),
    explain: order.map(i => m.explain[i]),
    correct,
    reveal: m.reveal || null,
  };
}

async function load() {
  if (caseId) {
    /* Admission définitive : cas clinique progressif (ordre fixe, révélations). */
    const cases = await (await fetch('um6ss/admission.json')).json();
    const c = cases.find(x => x.id === caseId);
    if (!c) throw new Error('no case');
    isCase = true;
    title = c.title;
    intro = c.scenario;
    questions = c.questions.map(prep).filter(q => q.options.length === 5 && q.correct.size >= 1);
  } else if (bankId) {
    /* Admissibilité : banque de 100 QCM isolés (ordre mélangé). */
    const idx = await (await fetch('um6ss/index.json')).json();
    const s = (idx.admissibilite || []).find(x => x.id === bankId);
    if (!s) throw new Error('no bank');
    title = s.subject + ' — 100 QCM';
    const bank = await (await fetch('um6ss/' + s.file)).json();
    questions = shuffle(bank.map(prep)).filter(q => q.options.length === 5 && q.correct.size >= 1);
  } else {
    throw new Error('no target');
  }
  if (!questions.length) throw new Error('empty');
}

try { await load(); }
catch (e) {
  console.error(e);
  app.innerHTML = `<div class="empty">Impossible de charger ce QCM.<br><a href="um6ss.html" class="linklike">← Retour UM6SS</a></div>`;
  document.body.insertAdjacentHTML('beforeend', tabbar('um6ss'));
  throw e;
}
document.title = title + ' — Flashcards FMPR';

const Q = { pos: 0, xp: 0, perfect: 0, answered: 0, started: false };

/* --------------------------- scénario --------------------------- */
function renderIntro() {
  app.innerHTML = `
    <a class="back" href="um6ss.html" style="text-decoration:none;display:inline-block">← UM6SS</a>
    <div class="topbar"><h2>📋 ${esc(title)}</h2></div>
    <div class="scenario">${esc(intro).replace(/\n/g, '<br>')}</div>
    <p class="small">Ce cas progressif comporte <b>${questions.length} QCM liés</b> qui suivent le patient :
    diagnostic → examens → traitement → complications. Coche toutes les bonnes réponses.</p>
    <button class="btn btn-primary" id="startCase">Commencer le cas →</button>`;
  document.getElementById('startCase').onclick = () => { Q.started = true; renderQ(); window.scrollTo({ top: 0 }); };
}

/* ----------------------------- rendu ----------------------------- */
function stepLabel() {
  return isCase
    ? `Question ${Q.pos + 1}/${questions.length} — ${esc(title)}`
    : `Question ${Q.pos + 1}/${questions.length}`;
}

function renderQ() {
  const q = questions[Q.pos];
  const sel = new Set();
  app.innerHTML = `
    <a class="back" href="um6ss.html" style="text-decoration:none;display:inline-block">← UM6SS</a>
    <div class="progress-line"><span>${stepLabel()}</span><span>⭐ ${Q.xp} XP</span></div>
    <div class="track" style="margin-bottom:14px"><div style="width:${Math.round(Q.pos / questions.length * 100)}%"></div></div>
    ${isCase ? '<div class="q-step">CAS CLINIQUE PROGRESSIF — ADMISSION</div>' : '<div class="q-step">QCM ADMISSIBILITÉ</div>'}
    <div class="mcq-q">${esc(q.q)}
      <div class="small" style="margin-top:8px;font-weight:400">Coche toutes les bonnes réponses.</div>
    </div>
    <div id="opts">${q.options.map((o, i) => `
      <button class="mopt" data-i="${i}">
        <span class="mbox"></span><span class="letter">${'ABCDE'[i]}</span>
        <span class="obody">${esc(o)}</span>
      </button>`).join('')}
    </div>
    <div class="confirmbar"><button class="btn btn-primary" id="confirm" disabled>Confirmer</button></div>
    <div id="after" hidden></div>`;

  const btns = Array.from(app.querySelectorAll('.mopt'));
  const confirmBtn = app.querySelector('#confirm');
  btns.forEach(b => b.onclick = () => {
    const i = +b.dataset.i;
    if (sel.has(i)) { sel.delete(i); b.classList.remove('sel'); }
    else { sel.add(i); b.classList.add('sel'); }
    confirmBtn.disabled = sel.size === 0;
  });
  confirmBtn.onclick = () => doConfirm(sel, btns, confirmBtn);
}

function doConfirm(sel, btns, confirmBtn) {
  const q = questions[Q.pos];
  let cp = 0, wp = 0;
  btns.forEach(b => {
    const i = +b.dataset.i;
    const isC = q.correct.has(i), isS = sel.has(i);
    if (isC && isS) cp++;
    if (!isC && isS) wp++;
    b.disabled = true;
    b.classList.remove('sel');
    if (isC && isS) b.classList.add('good');
    else if (isC && !isS) b.classList.add('missed');
    else if (!isC && isS) b.classList.add('bad');
    const tag = isC ? '<b style="color:var(--green)">✓ Bonne réponse.</b>' : '<b style="color:var(--red)">✕ Mauvaise réponse.</b>';
    b.querySelector('.obody').insertAdjacentHTML('beforeend',
      `<div class="mexp">${tag} ${esc(q.explain[i])}</div>`);
  });
  const perfect = cp === q.correct.size && wp === 0;
  const gained = perfect ? 20 : Math.max(0, 5 * cp - 5 * wp);
  Q.xp += gained;
  Q.answered++;
  if (perfect) Q.perfect++;

  const verdict = perfect
    ? `<div class="verdict perfect">🌟 Parfait ! +20 XP</div>`
    : gained > 0
      ? `<div class="verdict partial">👍 Partiel : ${cp} bonne(s), ${wp} mauvaise(s) → +${gained} XP</div>`
      : `<div class="verdict zero">❌ Raté — +0 XP. Relis les explications 👆</div>`;

  const reveal = q.reveal
    ? `<div class="reveal"><b>▶ La suite du cas…</b><br>${esc(q.reveal)}</div>`
    : '';

  const after = app.querySelector('#after');
  after.hidden = false;
  after.innerHTML = verdict + reveal + `
    <button class="btn btn-primary" id="qNext">${Q.pos + 1 === questions.length ? 'Voir mon score 🏁' : 'Question suivante →'}</button>
    <a class="linklike" href="um6ss.html" style="display:block;margin:10px auto;text-align:center">Abandonner</a>`;
  app.querySelector('#qNext').onclick = () => {
    Q.pos++;
    if (Q.pos >= questions.length) renderResult();
    else { renderQ(); window.scrollTo({ top: 0 }); }
  };
  confirmBtn.style.display = 'none';
  after.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* --------------------------- résultat --------------------------- */
let saved = false;
async function renderResult() {
  const nn = questions.length;
  const pct = Math.round(Q.perfect / nn * 100);
  if (!saved) {
    saved = true;
    profile.mcqTotal = (profile.mcqTotal || 0) + nn;
    profile.mcqCorrect = (profile.mcqCorrect || 0) + Q.perfect;
    addXp(Q.xp);
    saveProfile({});
    pushLeaderboard(true);
    touchStudy();
  }
  const msg = pct >= 80 ? 'Excellent travail ! 🌟' : pct >= 50 ? 'Bien, encore un effort 💪' : 'Revois les cartes et reviens plus fort 📚';
  app.innerHTML = `
    <div class="result">
      <div style="font-size:3rem">${pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📚'}</div>
      <h2 style="margin:8px 0">${esc(title)}</h2>
      <div class="score">${Q.perfect}/${nn}</div>
      <p><b>${pct}%</b> de réponses parfaites · <b style="color:var(--teal)">+${Q.xp} XP</b></p>
      <p class="small">${msg}</p>
      <button class="btn btn-primary" id="rAgain">🔁 Rejouer</button>
      <a class="btn btn-ghost" href="um6ss.html" style="text-decoration:none;text-align:center">Retour UM6SS</a>
      <a class="btn btn-ghost" href="home.html" style="text-decoration:none;text-align:center">Accueil</a>
    </div>`;
  document.getElementById('rAgain').onclick = () => location.reload();
}

if (intro && !Q.started) renderIntro();
else renderQ();
document.body.insertAdjacentHTML('beforeend', tabbar('um6ss'));
