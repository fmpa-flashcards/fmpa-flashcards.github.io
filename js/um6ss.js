/* UM6SS — Préparation au concours d'internat (Décembre 2026).
   Admissibilité : 4 épreuves de 100 QCM (Anatomie, Biologie, Pathologie
   médicale, Pathologie chirurgicale), 2 heures chacune — QCM isolés comme
   à l'examen.
   Admission définitive : 4 cas cliniques progressifs (Urgence médicale,
   Urgence chirurgicale, CAT médicale, CAT chirurgicale), 5 à 15 QCM liés
   par cas — session de 2 heures.
   Les quiz sont réservés à la formule Full, comme le mode QCM. */
import {
  requireAuth, esc, tabbar, hasFull,
} from './common.js';

/* L'auth démarre en parallèle : le contenu (en cache) se peint sans attendre. */
requireAuth();

const app = document.getElementById('app');
let tab = 'admissibilite';
let index = { admissibilite: [], admission: [] };

async function load() {
  try { index = await (await fetch('um6ss/index.json')).json(); }
  catch (e) { index = { admissibilite: [], admission: [] }; }
}

const lock = () => (hasFull() ? '' : ' 🔒');
const EMOJI = { anat: '🦴', bio: '🧬', med: '🩺', chir: '🔪' };

function subjectCard(s) {
  return `<a class="case-card" href="um6ss-quiz.html?bank=${s.id}">
    <h3>${EMOJI[s.id] || '📝'} ${esc(s.subject)}${lock()}</h3>
    <p>${esc(s.focus)}</p>
    <div class="meta"><span>❓ ${s.n} QCM</span><span>🎲 100 tirés au hasard</span><span>⏱️ ${esc(s.time)}</span><span>⚖️ Coef ${s.coef}</span></div>
  </a>`;
}

function caseCard(c, i) {
  return `<a class="case-card" href="um6ss-quiz.html?comp=${c.id}">
    <h3>${['🚨', '🔪', '💊', '🏥'][i] || '📋'} ${esc(c.title)}${lock()}</h3>
    <p>${esc(c.focus)}</p>
    <div class="meta"><span>📋 ${c.cases} cas cliniques</span><span>🎲 1 tiré au hasard</span><span>⚖️ Coef ${c.coef}</span></div>
  </a>`;
}

function render() {
  const head = `<div class="um6ss-head">
      <img src="um6ss-logo.png" alt="UM6SS">
      <div><h2 style="margin:0;font-size:1.15rem">Concours Internat — UM6SS</h2>
      <p class="small" style="margin:2px 0 0">QCM comme à l'examen · Décembre 2026</p></div>
    </div>
    <div class="um6ss-tabs">
      <button id="tabAdmissibilite" class="${tab === 'admissibilite' ? 'on' : ''}">📋 Admissibilité</button>
      <button id="tabAdmission" class="${tab === 'admission' ? 'on' : ''}">✅ Admission</button>
    </div>`;
  let body = '';
  if (tab === 'admissibilite') {
    body = `<p class="small">4 épreuves de <b>100 QCM</b> en 2 heures, comme le jour J — <b>1000 QCM par matière</b>, tirage aléatoire de 100 sans répétition. Chaque session apporte des questions inédites.</p>` +
      (index.admissibilite.length ? index.admissibilite.map(subjectCard).join('') : '<div class="empty">Chargement…</div>');
  } else {
    body = `<p class="small"><b>Épreuve d'admission définitive</b> — 2 heures : <b>10 grands cas cliniques progressifs</b> par composante (5 à 15 QCM liés par cas). Un cas est tiré au hasard à chaque session, sans répétition.</p>` +
      (index.admission.length ? index.admission.map(caseCard).join('') : '<div class="empty">Chargement…</div>');
  }
  app.innerHTML = head + body;
  document.getElementById('tabAdmissibilite').onclick = () => { tab = 'admissibilite'; render(); };
  document.getElementById('tabAdmission').onclick = () => { tab = 'admission'; render(); };
}

await load();
render();
document.body.insertAdjacentHTML('beforeend', tabbar('um6ss'));
