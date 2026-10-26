/* Discipline Clean Premium — chapitres et sujets avec anneaux de
   progression et recherche locale. Rendu immédiat depuis le cache :
   les sujets s'affichent tout de suite, les anneaux se remplissent
   en arrière-plan. */
import { requireAuth, loadDisc, loadIndex, getTP, esc, qp, tabbar, icon, ringSvg } from './common.js';

/* L'auth démarre tout de suite mais ne bloque pas le premier affichage. */
const authP = requireAuth();

const d = Math.max(0, parseInt(qp('d', '0'), 10) || 0);
const [disc, idx] = await Promise.all([loadDisc(d), loadIndex()]);
document.title = disc.name + ' — Flashcards FMPA';

const isPrepa = idx[d] && idx[d].section === 'prepa';
const backHref = isPrepa ? 'preparation.html' : 'home.html';
const backLabel = isPrepa ? 'Préparation' : 'Disciplines';

const byChapter = {};
for (const t of disc.topics) {
  const ch = t.chapter || 'Divers';
  (byChapter[ch] = byChapter[ch] || []).push(t);
}
const totalCards = disc.topics.reduce((s, t) => s + t.cards.length, 0);

function tcard(t) {
  return `<a class="tcard" href="topic.html?d=${d}&id=${encodeURIComponent(t.id)}">
    <div class="tt">${esc(t.topic)}</div>
    <div class="tc">${t.cards.length} cartes</div>
    <div class="tfoot"><span class="ring" data-tp="${esc(t.id)}"></span><span class="go" data-go="${esc(t.id)}">Réviser →</span></div>
  </a>`;
}

function chaptersHtml(filter) {
  const q = (filter || '').trim().toLowerCase();
  let html = '';
  let shown = 0;
  for (const [ch, topics] of Object.entries(byChapter)) {
    const list = q ? topics.filter(t => t.topic.toLowerCase().includes(q)) : topics;
    if (!list.length) continue;
    shown += list.length;
    html += `<div class="chap">${esc(ch)}</div><div class="grid">` +
      list.map(t => tcard(t)).join('') + `</div>`;
  }
  return shown ? html : `<p class="small" style="text-align:center">Aucun sujet trouvé pour « ${esc(filter.trim())} ».</p>`;
}

document.getElementById('app').innerHTML = `
  <a class="back" href="${backHref}" style="text-decoration:none;display:inline-block">← ${backLabel}</a>
  <div class="topbar"><h2 style="font-size:1.15rem">${esc(disc.name)}</h2></div>
  <div class="disc-sub">${disc.topics.length} sujets · ${totalCards.toLocaleString('fr-FR')} cartes</div>
  <div class="searchbar">${icon('search')}<input id="q" type="search" placeholder="Rechercher dans ${esc(disc.name)}…" autocomplete="off"></div>
  <div id="discBody">${chaptersHtml('')}</div>`;
document.body.insertAdjacentHTML('beforeend', tabbar(isPrepa ? 'prepa' : 'home'));

document.getElementById('q').addEventListener('input', (e) => {
  const body = document.getElementById('discBody');
  body.innerHTML = chaptersHtml(e.target.value);
  fillRings(body);
});

/* Progression remplie en arrière-plan, sans bloquer l'affichage. */
async function fillRings(scope) {
  try { await authP; } catch (e) { return; }
  const spans = Array.from((scope || document).querySelectorAll('[data-tp]'));
  await Promise.all(spans.map(async (sp) => {
    try {
      const t = disc.topics.find(x => x.id === sp.dataset.tp);
      if (!t || !t.cards.length) { sp.outerHTML = ringSvg(0); return; }
      const tp = await getTP(t.id);
      const pct = Math.round(tp.seen.length / t.cards.length * 100);
      sp.outerHTML = ringSvg(pct);
      const go = (scope || document).querySelector(`[data-go="${CSS.escape(t.id)}"]`);
      if (go) go.textContent = pct >= 100 ? 'Terminé' : pct > 0 ? 'Continuer →' : 'Réviser →';
    } catch (e) { sp.outerHTML = ringSvg(0); }
  }));
}
fillRings(document);
