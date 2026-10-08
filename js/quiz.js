/* Quiz multi-réponses : cases à cocher, bouton Confirmer,
   correction par option avec explications, score partiel.
   URL : quiz.html?kind=topic&d=0&id=tXXX&n=20  ou  quiz.html?kind=mix&n=20 */
import {
  requireAuth, profile, guardFull, loadTopicMcqm, loadMcqmIndex,
  shuffle, esc, qp, tabbar, toast, addXp, pushLeaderboard, touchStudy,
  saveProfile, getTP, saveTP
} from './common.js';

await requireAuth();
if (!guardFull('Mode QCM', 'mcq')) throw new Error('locked');

const app = document.getElementById('app');
const kind = qp('kind', 'mix');
const n = Math.min(200, Math.max(1, parseInt(qp('n', '20'), 10) || 20));
const topicId = qp('id');

/* ------------------------- chargement ------------------------- */
async function loadQuestions() {
  if (kind === 'topic' && topicId) {
    const arr = await loadTopicMcqm(topicId);
    return { title: null, list: shuffle(arr).slice(0, n) };
  }
  // mixte : pioche des sujets au hasard, charge leurs banques en parallèle
  const idx = await loadMcqmIndex();
  const need = Math.min(idx.length, Math.max(4, Math.ceil(n / 8)));
  const picks = shuffle(idx).slice(0, need);
  const all = [];
  await Promise.all(picks.map(async (t) => {
    try { all.push(...await loadTopicMcqm(t.id)); } catch (e) {}
  }));
  return { title: 'QCM mixte — toutes disciplines', list: shuffle(all).slice(0, n) };
}

/* Mélange l'ordre des options et recalcule les index corrects. */
function prep(m) {
  const order = shuffle([0, 1, 2, 3, 4]);
  const correct = new Set();
  order.forEach((orig, i) => { if (m.correct.includes(orig)) correct.add(i); });
  return {
    q: m.q,
    options: order.map(i => m.options[i]),
    explain: order.map(i => m.explain[i]),
    correct,
  };
}

let title = 'QCM';
let questions = [];
try {
  const res = await loadQuestions();
  questions = res.list.map(prep).filter(q => q.options.length === 5 && q.correct.size >= 2);
  if (res.title) title = res.title;
  else if (kind === 'topic') title = 'QCM — sujet';
} catch (e) {
  console.error(e);
}
if (!questions.length) {
  app.innerHTML = `<div class="empty">Impossible de charger ce QCM.<br><a href="qcm.html" class="linklike">← Retour au QCM</a></div>`;
  document.body.insertAdjacentHTML('beforeend', tabbar('mcq'));
  throw new Error('no questions');
}
document.title = title + ' — Flashcards FMPR';

const Q = { pos: 0, xp: 0, perfect: 0, answered: 0 };

/* --------------------------- rendu --------------------------- */
function renderQ() {
  const q = questions[Q.pos];
  const sel = new Set();
  app.innerHTML = `
    <div class="progress-line"><span>Question ${Q.pos + 1}/${questions.length}</span><span>⭐ ${Q.xp} XP</span></div>
    <div class="track" style="margin-bottom:14px"><div style="width:${Math.round(Q.pos / questions.length * 100)}%"></div></div>
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

  const after = app.querySelector('#after');
  after.hidden = false;
  after.innerHTML = verdict + `
    <button class="btn btn-primary" id="qNext">${Q.pos + 1 === questions.length ? 'Voir mon score 🏁' : 'Question suivante →'}</button>
    <a class="linklike" href="qcm.html" style="display:block;margin:10px auto;text-align:center">Abandonner</a>`;
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
    if (kind === 'topic' && topicId) {
      const tp = await getTP(topicId);
      tp.correct += Q.perfect; tp.wrong += (nn - Q.perfect);
      saveTP(topicId);
    }
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
      <a class="btn btn-ghost" href="qcm.html" style="text-decoration:none;text-align:center">Choisir un autre QCM</a>
      <a class="btn btn-ghost" href="home.html" style="text-decoration:none;text-align:center">Accueil</a>
    </div>`;
  document.getElementById('rAgain').onclick = () => location.reload();
}

renderQ();
document.body.insertAdjacentHTML('beforeend', tabbar('mcq'));
