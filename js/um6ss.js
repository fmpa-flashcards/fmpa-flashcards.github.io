/* UM6SS — Préparation au concours d'internat.
   Admissibilité : 4 cas cliniques progressifs (Anatomie, Biologie, Pathologie
   médicale, Pathologie chirurgicale), chacun avec 5 à 10 QCM liés qui suivent
   le parcours d'un patient.
   Admission : QCM par sujet (Médecine / Chirurgie).
   Les quiz sont réservés à la formule Full, comme le mode QCM. */
import {
  requireAuth, esc, tabbar, hasFull,
} from './common.js';

/* L'auth démarre en parallèle : le contenu (en cache) se peint sans attendre. */
requireAuth();

const app = document.getElementById('app');
let tab = 'admissibilite';
let cases = [];
let admIndex = { medecine: [], chirurgie: [] };

async function load() {
  try { cases = await (await fetch('um6ss/admissibilite.json')).json(); }
  catch (e) { cases = []; }
  try { admIndex = await (await fetch('um6ss/admission.json')).json(); }
  catch (e) { admIndex = { medecine: [], chirurgie: [] }; }
}

const lock = () => (hasFull() ? '' : ' 🔒');

function caseCard(c, i) {
  return `<a class="case-card" href="um6ss-quiz.html?case=${c.id}">
    <h3>${['🦴', '🧬', '🩺', '🔪'][i] || '📋'} ${esc(c.subject)} — ${esc(c.title)}${lock()}</h3>
    <p>${esc(c.teaser)}</p>
    <div class="meta"><span>📋 Cas clinique progressif</span><span>❓ ${c.questions.length} QCM liés</span></div>
  </a>`;
}

function admTopic(t) {
  return `<a class="topic" href="um6ss-quiz.html?adm=${t.id}" style="text-decoration:none;color:inherit">
    <div><div class="t">${esc(t.title)}${lock()}</div><div class="c">${t.n} QCM</div></div>
    <div class="pct">→</div>
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
    body = `<p class="small">4 cas cliniques progressifs — chaque cas suit un patient en 8 à 10 QCM liés : diagnostic → examens → traitement → complications.</p>` +
      (cases.length ? cases.map(caseCard).join('') : '<div class="empty">Chargement…</div>');
  } else {
    const med = admIndex.medecine || [], chir = admIndex.chirurgie || [];
    body = `<div class="chapter">Médecine (${med.length} sujets)</div>` +
      (med.length ? med.map(admTopic).join('') : '<div class="empty">Chargement…</div>') +
      `<div class="chapter">Chirurgie (${chir.length} sujets)</div>` +
      (chir.length ? chir.map(admTopic).join('') : '');
  }
  app.innerHTML = head + body;
  document.getElementById('tabAdmissibilite').onclick = () => { tab = 'admissibilite'; render(); };
  document.getElementById('tabAdmission').onclick = () => { tab = 'admission'; render(); };
}

await load();
render();
document.body.insertAdjacentHTML('beforeend', tabbar('um6ss'));
