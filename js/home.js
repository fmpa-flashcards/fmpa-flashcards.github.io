/* Accueil Clean Premium — salutation + série/XP (dès le cache local),
   carte « Reprendre », recherche, pilules disciplines, sujets avec
   anneaux de progression. Rendu immédiat depuis le cache : l'auth
   tourne en parallèle et la personnalisation suit. */
import { requireAuth, profile, isPro, loadIndex, loadDisc, levelFor, getTP, esc, tabbar, cachedProfile, cacheProfile, icon, ringSvg } from './common.js';

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
const firstName = (p) => ((p.nickname || p.displayName || 'Doc').split(' ')[0]);

function pillsHtml() {
  return `<div class="pills">` + discs.map(({ d, i }) =>
    `<button class="pill${i === sel ? ' on' : ''}" data-disc="${i}">${esc(d.name)} <span>${d.topics}</span></button>`
  ).join('') + `</div>`;
}

function resumeHtml() {
  let r = null;
  try { r = JSON.parse(localStorage.getItem('fmpa_resume') || 'null'); } catch (e) {}
  if (!r || !r.id) return '';
  const pos = Math.max(0, Math.min((r.total || 1) - 1, r.pos || 0));
  return `<a class="resume-card" href="topic.html?d=${r.d}&id=${encodeURIComponent(r.id)}&c=${pos}" style="text-decoration:none">
    <div class="rc-txt">
      <div class="rc-eyebrow">Reprendre où tu t'es arrêté</div>
      <div class="rc-title">${esc(r.title)}</div>
      <div class="rc-sub">${esc(r.discName || '')} · Carte ${pos + 1}/${r.total || '?'}</div>
    </div>
    <span class="btn btn-gold">Continuer →</span>
  </a>`;
}

function tcard(t, dIdx, sub, pct) {
  const done = pct != null && pct >= 100;
  const started = pct != null && pct > 0;
  const label = done ? 'Terminé' : started ? 'Continuer →' : 'Réviser →';
  const ring = pct == null
    ? `<span class="ring" data-ring="${esc(t.id || t.t)}" data-disc="${dIdx}"></span>`
    : ringSvg(pct);
  return `<a class="tcard" href="topic.html?d=${dIdx}&id=${encodeURIComponent(t.id || t.t)}">
    <div class="tt">${esc(t.topic || t.t)}</div>
    <div class="tc">${sub}</div>
    <div class="tfoot">${ring}<span class="go">${label}</span></div>
  </a>`;
}

/* Remplit les anneaux de progression en arrière-plan (sans bloquer l'affichage). */
async function fillRings(scope) {
  const spans = Array.from((scope || document).querySelectorAll('[data-ring]'));
  if (!spans.length) return;
  try { await authP; } catch (e) { return; }
  await Promise.all(spans.map(async (sp) => {
    try {
      const disc = await loadDisc(parseInt(sp.dataset.disc || sel, 10));
      const t = disc.topics.find(x => x.id === sp.dataset.ring);
      if (!t || !t.cards.length) { sp.outerHTML = ringSvg(0); return; }
      const tp = await getTP(t.id);
      sp.outerHTML = ringSvg(Math.round(tp.seen.length / t.cards.length * 100));
    } catch (e) { sp.outerHTML = ringSvg(0); }
  }));
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
  if (body) { body.innerHTML = html; fillRings(body); }
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
  if (box) { box.innerHTML = html; fillRings(box); }
}

/* ------------------------------ squelette ----------------------------- */
/* Salutation + série + XP affichés tout de suite depuis le profil mis en
   cache à la dernière connexion — plus d'écran vide quand l'auth traîne. */
const cp = cachedProfile() || {};
const cpFirst = firstName(cp);
const cpLvl = levelFor(cp.xp || 0);
const cpPct = Math.round(((cp.xp || 0) % 500) / 500 * 100);
document.getElementById('app').innerHTML = `
  <div class="topbar">
    <h2 id="hello">Salut ${esc(cpFirst)}</h2>
    <div class="streak" id="streak">${icon('flame')} <span id="streakN">${cp.streak || 0}</span>&nbsp;jour${(cp.streak || 0) > 1 ? 's' : ''} de série</div>
  </div>
  <div class="hello-sub" id="helloSub">443 sujets · 6 861 cartes · FMPA Agadir</div>
  <div class="xpbar" id="xpbar">
    <div class="row"><b id="lvl">Niveau ${cpLvl}</b><span id="xp"><b>${(cp.xp || 0).toLocaleString('fr-FR')} XP</b> · encore ${500 - ((cp.xp || 0) % 500)} XP avant le Niveau ${cpLvl + 1}</span></div>
    <div class="track"><div id="xpfill" style="width:${cpPct}%"></div></div>
  </div>
  <div id="resumeSlot">${resumeHtml()}</div>
  <div class="searchbar">${icon('search')}<input id="q" type="search" placeholder="Rechercher un sujet…" autocomplete="off"></div>
  ${pillsHtml()}
  <div id="demoNote"></div>
  <div id="discBody"></div>
  <div id="searchBody"></div>`;
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
  cacheProfile();
  const p = profile || {};
  const first = firstName(p);
  const hello = document.getElementById('hello');
  if (hello) hello.textContent = `Salut ${first}`;
  const streakN = document.getElementById('streakN');
  if (streakN) streakN.textContent = String(p.streak || 0);
  const lvl = levelFor(p.xp || 0);
  document.getElementById('lvl').textContent = `Niveau ${lvl}`;
  document.getElementById('xp').innerHTML = `<b>${(p.xp || 0).toLocaleString('fr-FR')} XP</b> · encore ${500 - ((p.xp || 0) % 500)} XP avant le Niveau ${lvl + 1}`;
  document.getElementById('xpfill').style.width = `${Math.round(((p.xp || 0) % 500) / 500 * 100)}%`;
  if (!isPro()) {
    const dn = document.getElementById('demoNote');
    if (dn) dn.innerHTML = `<div class="demo-note"><b>Mode démo</b> — 5 cartes par sujet.
      <a href="profil.html" style="color:#0a5f66;font-weight:700">Débloque tout dès 100 DH →</a></div>`;
  }
}).catch(() => {});
