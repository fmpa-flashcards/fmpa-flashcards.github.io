/* QCM : accueil, choix du sujet, choix du nombre de questions. */
import {
  requireAuth, guardFull, loadIndex, loadDisc, loadAllDiscs, topicEntry,
  esc, qp, tabbar, DISC_EMOJI
} from './common.js';

await requireAuth();
if (!guardFull('Mode QCM', 'mcq')) throw new Error('locked');

const page = document.body.dataset.page;
const app = document.getElementById('app');

if (page === 'home') {
  const idx = await loadIndex();
  app.innerHTML = `
    <div class="topbar"><h2>✅ Mode QCM</h2></div>
    <p class="small">Des QCM multi-réponses comme à l'examen : coche toutes les bonnes réponses,
      puis <b>Confirmer</b> pour voir la correction détaillée.<br>
      <b>20 XP</b> par réponse parfaite, points partiels sinon.</p>
    <a class="topic" href="qcm-setup.html?kind=mix" style="text-decoration:none;color:inherit">
      <div><div class="t">🎲 QCM mixte</div><div class="c">Toutes disciplines mélangées</div></div>
      <div class="pct">→</div>
    </a>
    <div class="chapter">Par discipline</div>
    ${idx.map((d, i) => ({ d, i })).filter(x => x.d.section !== 'prepa').map(({ d, i }) => `
      <a class="topic" href="qcm-sujets.html?d=${i}" style="text-decoration:none;color:inherit">
        <div><div class="t">${DISC_EMOJI[i] || '📚'} ${esc(d.name)}</div><div class="c">${d.topics} sujets · 200 QCM/sujet</div></div>
        <div class="pct">→</div>
      </a>`).join('')}`;
} else if (page === 'sujets') {
  const d = Math.max(0, parseInt(qp('d', '0'), 10) || 0);
  const disc = await loadDisc(d);
  const idx = await loadIndex();
  document.title = 'QCM — ' + disc.name;
  const byChapter = {};
  for (const t of disc.topics) (byChapter[t.chapter || 'Divers'] = byChapter[t.chapter || 'Divers'] || []).push(t);
  let html = `<a class="back" href="qcm.html" style="text-decoration:none;display:inline-block">← QCM</a>
    <div class="topbar"><h2>Choisis un sujet</h2></div>`;
  for (const [ch, topics] of Object.entries(byChapter)) {
    html += `<div class="chapter">${esc(ch)}</div>` + topics.map(t => `
      <a class="topic" href="qcm-setup.html?kind=topic&d=${d}&id=${encodeURIComponent(t.id)}" style="text-decoration:none;color:inherit">
        <div><div class="t">${esc(t.topic)}</div><div class="c">200 QCM</div></div>
        <div class="pct">→</div>
      </a>`).join('');
  }
  app.innerHTML = html;
} else if (page === 'setup') {
  const kind = qp('kind', 'mix');
  const id = qp('id');
  let title = 'QCM mixte — toutes disciplines';
  let quizHref;
  if (kind === 'topic' && id) {
    const dParam = Math.max(0, parseInt(qp('d', '-1'), 10));
    if (dParam >= 0) await loadDisc(dParam); // only the discipline from the URL
    let e = topicEntry(id);
    if (!e) { await loadAllDiscs(); e = topicEntry(id); } // stale ?d= fallback
    if (!e) location.replace('qcm.html');
    title = e.topic.topic;
    const d = e.discIdx;
    quizHref = (n) => `quiz.html?kind=topic&d=${d}&id=${encodeURIComponent(id)}&n=${n}`;
  } else {
    quizHref = (n) => `quiz.html?kind=mix&n=${n}`;
  }
  document.title = 'QCM — ' + title;
  app.innerHTML = `
    <a class="back" href="qcm.html" style="text-decoration:none;display:inline-block">← QCM</a>
    <div class="mcq-setup">
      <h3 style="margin:0 0 4px">${esc(title)}</h3>
      <p class="small">Combien de questions ?</p>
      <div class="qcm-count">
        ${[10, 20, 50, 100, 200].map(n => `<a class="btn btn-ghost" href="${quizHref(n)}" style="text-decoration:none;text-align:center">${n} questions</a>`).join('')}
      </div>
      <p class="small mt">💡 20 XP par réponse parfaite · points partiels : +5 par bonne réponse cochée, −5 par mauvaise.</p>
    </div>`;
}

document.body.insertAdjacentHTML('beforeend', tabbar('mcq'));
