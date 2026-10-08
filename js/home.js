/* Accueil — pilules disciplines + recherche + sujets (style référence).
   Rendu immédiat depuis le cache (aucun écran de chargement) :
   l'auth tourne en parallèle et la personnalisation suit. */
import { requireAuth, profile, isPro, loadIndex, loadDisc, levelFor, esc, tabbar } from './common.js';

/* L'auth démarre tout de suite mais ne bloque pas le premier affichage. */
const authP = requireAuth();

const idx = await loadIndex();
const discs = idx.map((d, i) => ({ d, i })).filter(x => x.d.section !== 'prepa');
let sel = parseInt(localStorage.getItem('fmpr_home_disc') || '2', 10);
if (!discs.some(x => x.i === sel)) sel = discs[0].i;

let topicsIdx = [];
try { topicsIdx = await (await fetch('topics-index.json')).json(); }
catch (e) { topicsIdx = []; }

/* ------------------------------- rendu -------------------------------- */
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/œ/g, 'oe').replace(/æ/g, 'ae');

function pillsHtml() {
  return `<div class="pills">` + discs.map(({ d, i }) =>
    `<button class="pill${i === sel ? ' on' : ''}" data-disc="${i}">${esc(d.name)} <span>${d.topics}</span></button>`
  ).join('') + `</div>`;
}

function tcard(t, dIdx, sub) {
  return `<a class="tcard" href="topic.html?d=${dIdx}&id=${encodeURIComponent(t.id || t.t)}">
    <div class="tt">${esc(t.topic || t.t)}</div>
    <div class="tc">${sub}</div>
    <div class="go">Réviser →</div>
  </a>`;
}

async function renderDisc() {
  const disc = await loadDisc(sel);
  const info = idx[sel];
  const byChapter = {};
  for (const t of disc.topics) {
    const ch = t.chapter || 'Divers';
    (byChapter[ch] = byChapter[ch] || []).push(t);
  }
  let html = `<div class="disc-sub">${info.topics} sujets · ${Number(info.cards).toLocaleString('fr-FR')} cartes — ${esc(info.name)}</div>`;
  for (const [ch, topics] of Object.entries(byChapter)) {
    html += `<div class="chap">${esc(ch)}</div><div class="grid">` +
      topics.map(t => tcard(t, sel, `${t.cards.length} cartes`)).join('') + `</div>`;
  }
  const body = document.getElementById('discBody');
  if (body) body.innerHTML = html;
}

function renderSearch(q) {
  const box = document.getElementById('searchBody');
  const disc = document.getElementById('discBody');
  const nq = norm(q.trim());
  if (!nq) { if (box) box.innerHTML = ''; if (disc) disc.style.display = ''; return; }
  if (disc) disc.style.display = 'none';
  if (!topicsIdx.length) {
    if (box) box.innerHTML = `<p class="small" style="text-align:center">Recherche indisponible hors-ligne.</p>`;
    return;
  }
  const hits = topicsIdx.filter(t => norm(t.t).includes(nq)).slice(0, 80);
  if (!hits.length) {
    if (box) box.innerHTML = `<p class="small" style="text-align:center">Aucun sujet trouvé pour « ${esc(q.trim())} ».</p>`;
    return;
  }
  const byD = {};
  for (const h of hits) (byD[h.d] = byD[h.d] || []).push(h);
  let html = `<div class="disc-sub">${hits.length} résultat${hits.length > 1 ? 's' : ''}</div>`;
  for (const d of Object.keys(byD).map(Number).sort((a, b) => a - b)) {
    html += `<div class="chap">${esc(idx[d].name)}</div><div class="grid">` +
      byD[d].map(h => tcard(h, h.d, `${h.n} cartes · ${esc(h.c)}`)).join('') + `</div>`;
  }
  if (box) box.innerHTML = html;
}

/* ------------------------------ squelette ----------------------------- */
document.getElementById('app').innerHTML = `
  <div class="topbar">
    <h2 id="hello">👋</h2>
    <div class="streak" id="streak" hidden>🔥 0</div>
  </div>
  <div class="xpbar" id="xpbar" hidden>
    <div class="row"><b id="lvl">Niveau 1</b><span id="xp">0 XP</span></div>
    <div class="track"><div id="xpfill" style="width:0%"></div></div>
  </div>
  <div class="searchbar"><input id="q" type="search" placeholder="🔍 Rechercher un sujet…" autocomplete="off"></div>
  ${pillsHtml()}
  <div id="demoNote"></div>
  <div id="discBody"></div>
  <div id="searchBody"></div>
  <a class="patho-banner" href="pathologies.html?v=8">
    <span>🩺 <b>Pathologies</b> <small>11 930 fiches · 20 spécialités · prix CNOPS</small></span>
    <span class="go">Ouvrir →</span>
  </a>`;
document.body.insertAdjacentHTML('beforeend', tabbar('home'));

document.querySelectorAll('.pill').forEach(b => b.onclick = () => {
  sel = parseInt(b.dataset.disc, 10);
  localStorage.setItem('fmpr_home_disc', String(sel));
  document.querySelectorAll('.pill').forEach(x => x.classList.toggle('on', x === b));
  const q = document.getElementById('q');
  if (q) q.value = '';
  renderSearch('');
  renderDisc();
  b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
});
document.getElementById('q').addEventListener('input', (e) => renderSearch(e.target.value));

renderDisc();

/* -------------------------- personnalisation --------------------------- */
authP.then(() => {
  const p = profile || {};
  const first = ((p.nickname || p.displayName || 'Doc').split(' ')[0]);
  const hello = document.getElementById('hello');
  if (hello) hello.textContent = `Salut ${first} 👋`;
  const streak = document.getElementById('streak');
  if (streak) { streak.hidden = false; streak.textContent = `🔥 ${p.streak || 0}`; }
  const lvl = levelFor(p.xp || 0);
  const xpbar = document.getElementById('xpbar');
  if (xpbar) {
    xpbar.hidden = false;
    document.getElementById('lvl').textContent = `Niveau ${lvl}`;
    document.getElementById('xp').textContent = `${(p.xp || 0).toLocaleString('fr-FR')} XP`;
    document.getElementById('xpfill').style.width = `${Math.round(((p.xp || 0) % 500) / 500 * 100)}%`;
  }
  if (!isPro()) {
    const dn = document.getElementById('demoNote');
    if (dn) dn.innerHTML = `<div class="demo-note">🎁 <b>Mode démo</b> — 5 cartes par sujet.
      <a href="profil.html" style="color:#0a5f66;font-weight:700">Débloque tout dès 100 DH →</a></div>`;
  }
  const pb = document.querySelector('.patho-banner .go');
  if (pb && !isPro()) pb.textContent = '🔒 Pro →';
}).catch(() => {});
