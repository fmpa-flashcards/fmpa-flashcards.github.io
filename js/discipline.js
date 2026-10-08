/* Discipline — chapitres et sujets.
   Rendu immédiat depuis le cache : les sujets s'affichent tout de suite,
   les pourcentages de progression se remplissent en arrière-plan. */
import { requireAuth, loadDisc, loadIndex, getTP, esc, qp, tabbar } from './common.js';

/* L'auth démarre tout de suite mais ne bloque pas le premier affichage. */
const authP = requireAuth();

const d = Math.max(0, parseInt(qp('d', '0'), 10) || 0);
const [disc, idx] = await Promise.all([loadDisc(d), loadIndex()]);
document.title = disc.name + ' — Flashcards FMPR';

const isPrepa = idx[d] && idx[d].section === 'prepa';
const backHref = isPrepa ? 'preparation.html' : 'home.html';
const backLabel = isPrepa ? 'Préparation' : 'Disciplines';

const byChapter = {};
for (const t of disc.topics) {
  const ch = t.chapter || 'Divers';
  (byChapter[ch] = byChapter[ch] || []).push(t);
}

let html = `<a class="back" href="${backHref}" style="text-decoration:none;display:inline-block">← ${backLabel}</a>
  <div class="topbar"><h2 style="font-size:1.15rem">${esc(disc.name)}</h2></div>
  <div class="disc-sub">${disc.topics.length} sujets · ${disc.topics.reduce((s, t) => s + t.cards.length, 0).toLocaleString('fr-FR')} cartes</div>`;
for (const [ch, topics] of Object.entries(byChapter)) {
  html += `<div class="chap">${esc(ch)}</div><div class="grid">`;
  for (const t of topics) {
    html += `<a class="tcard" href="topic.html?d=${d}&id=${encodeURIComponent(t.id)}">
      <div class="tt">${esc(t.topic)}</div>
      <div class="tc">${t.cards.length} cartes · <span class="pct" data-tp="${esc(t.id)}">…</span></div>
      <div class="go">Réviser →</div>
    </a>`;
  }
  html += `</div>`;
}

document.getElementById('app').innerHTML = html;
document.body.insertAdjacentHTML('beforeend', tabbar(isPrepa ? 'prepa' : 'home'));

/* Progression remplie en arrière-plan, sans bloquer l'affichage. */
authP.then(async () => {
  const spans = Array.from(document.querySelectorAll('[data-tp]'));
  await Promise.all(spans.map(async (sp) => {
    try {
      const t = disc.topics.find(x => x.id === sp.dataset.tp);
      if (!t || !t.cards.length) { sp.textContent = ''; return; }
      const tp = await getTP(t.id);
      sp.textContent = Math.round(tp.seen.length / t.cards.length * 100) + '% vu';
    } catch (e) { sp.textContent = ''; }
  }));
}).catch(() => {});
