/* Pathologies — navigateur de fiches (Pro uniquement). Données : patho/*.json */
import { requireAuth, guardPro, esc, qp, tabbar } from './common.js?v=8';

/* État données — déclaré AVANT tout await de niveau supérieur. */
let _idx = null, _names = null, _drugIdx = null;
const _fiches = {}, _prices = {};

await requireAuth();
if (!guardPro('Pathologies', 'home')) { /* verrou affiché */ }
else {
  const mode = qp('mode', '');
  if (mode === 'drugs') await drugsView();
  else if (qp('id')) await ficheView(qp('s', ''), qp('id'));
  else if (qp('s')) await specView(qp('s'));
  else await homeView();
}
window.__pathoBooted = true;
document.body.insertAdjacentHTML('beforeend', tabbar('home'));

/* ------------------------------ données ------------------------------ */
async function loadIdx() {
  if (!_idx) _idx = await (await fetch('patho/index.json')).json();
  return _idx;
}
async function loadNames() {
  if (!_names) _names = await (await fetch('patho/names.json')).json();
  return _names;
}
async function loadDrugIdx() {
  if (!_drugIdx) _drugIdx = await (await fetch('patho/drug_index.json')).json();
  return _drugIdx;
}
async function loadFiches(slug) {
  if (!_fiches[slug]) _fiches[slug] = await (await fetch('patho/fiches/' + slug + '.json')).json();
  return _fiches[slug];
}
async function loadPrices(slug) {
  if (!_prices[slug]) _prices[slug] = await (await fetch('patho/prices/' + slug + '.json')).json();
  return _prices[slug];
}
function specName(slug, idx) {
  const e = idx.find(x => x.slug === slug);
  return e ? e.specialite : slug;
}
function searchBox(id, placeholder) {
  return `<div class="patho-search"><input class="input" id="${id}" placeholder="${placeholder}" autocomplete="off"></div><div id="${id}-res"></div>`;
}

/* ------------------------------ accueil ------------------------------ */
async function homeView() {
  const idx = await loadIdx();
  const cards = idx.map(s => `
    <a class="disc" href="pathologies.html?s=${esc(s.slug)}" style="text-decoration:none;color:inherit">
      <h3>${esc(s.specialite)}</h3>
      <small>${Number(s.count).toLocaleString('fr-FR')} fiches</small>
    </a>`).join('');
  document.getElementById('app').innerHTML = `
    <div class="topbar"><h2>🩺 Pathologies</h2><div class="streak">Pro ✅</div></div>
    ${searchBox('q', '🔍 Rechercher une pathologie…')}
    <div style="margin:10px 0"><a href="pathologies.html?mode=drugs" class="btn btn-ghost" style="text-decoration:none;display:block;text-align:center">💊 Recherche médicaments (prix CNOPS)</a></div>
    <div class="grid spec-grid">${cards}</div>`;
  const inp = document.getElementById('q');
  inp.addEventListener('input', async () => {
    const q = inp.value.trim().toLowerCase();
    const box = document.getElementById('q-res');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const names = await loadNames();
    const hits = names.filter(n => n.nom.toLowerCase().includes(q)).slice(0, 40);
    box.innerHTML = '<div class="fiche-list">' + (hits.length
      ? hits.map(n => `<a href="pathologies.html?s=${esc(n.slug)}&id=${esc(n.id)}">${esc(n.nom)}<br><small>${esc(n.spec)}</small></a>`).join('')
      : '<p class="small">Aucun résultat.</p>') + '</div>';
  });
}

/* --------------------------- liste spécialité -------------------------- */
async function specView(slug) {
  const idx = await loadIdx();
  const list = await loadFiches(slug);
  const rows = list.map(f => `
    <a href="pathologies.html?s=${esc(slug)}&id=${esc(f.id)}">${esc(f.nom)}</a>`).join('');
  document.getElementById('app').innerHTML = `
    <a class="back" href="pathologies.html">← Pathologies</a>
    <div class="topbar"><h2>${esc(specName(slug, idx))}</h2></div>
    ${searchBox('q2', '🔍 Filtrer dans cette spécialité…')}
    <div class="fiche-list" id="speclist">${rows}</div>`;
  const inp = document.getElementById('q2');
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    document.getElementById('speclist').innerHTML = q.length < 2 ? rows :
      list.filter(f => f.nom.toLowerCase().includes(q))
        .map(f => `<a href="pathologies.html?s=${esc(slug)}&id=${esc(f.id)}">${esc(f.nom)}</a>`).join('')
        || '<p class="small">Aucun résultat.</p>';
  });
}

/* ------------------------------- fiche --------------------------------- */
function li(items) {
  return '<ul>' + items.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>';
}
function section(title, inner, open) {
  return `<details class="fsec"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="body">${inner}</div></details>`;
}
function priceFor(line, priceList) {
  if (!priceList) return '';
  const e = priceList.find(p => p.medicament === line.medicament);
  if (!e || !e.best_match) return '';
  const b = e.best_match;
  return `<div class="prix">💊 ${esc(b.nom)} ${esc(b.dosage || '')} ${esc(b.forme || '')} — <b>${esc(String(b.ppv))} MAD</b> (${esc(b.type || '')})</div>`;
}
async function ficheView(slug, id) {
  const idx = await loadIdx();
  const list = await loadFiches(slug);
  const f = list.find(x => x.id === id);
  if (!f) { document.getElementById('app').innerHTML = '<p>Fiche introuvable.</p>'; return; }
  let priceList = null;
  try { priceList = await loadPrices(slug).then(p => p[id] || null); } catch (e) {}
  const t = f.traitement || {};
  const ordos = (t.ordonnances || []).map(o => `
    <div class="ordo">
      <div class="titre">${esc(o.titre)}</div>
      ${(o.lignes || []).map(l => `
        <div class="ligne">
          <div class="med">${esc(l.medicament)}</div>
          <div>📋 ${esc(l.posologie)} · ⏱ ${esc(l.duree)}</div>
          ${priceFor(l, priceList)}
        </div>`).join('')}
      ${o.surveillance ? `<div class="surv">👁 ${esc(o.surveillance)}</div>` : ''}
    </div>`).join('');
  const trt = li(t.mesures || []) + ordos;
  document.getElementById('app').innerHTML = `
    <a class="back" href="pathologies.html?s=${esc(slug)}">← ${esc(specName(slug, idx))}</a>
    <div class="topbar"><h2 style="font-size:1.15em">${esc(f.nom)}</h2></div>
    <div class="fiche-def">${esc(f.definition)}</div>
    ${section('🩺 Clinique', li(f.clinique || []), true)}
    ${section('🧪 Paraclinique', li(f.paraclinique || []))}
    ${section('⚠️ Complications', li(f.complications || []))}
    ${section('💊 Traitement', trt)}
    ${section('🤢 Effets indésirables', li(f.effets_indesirables || []))}
    ${section('🚫 Contre-indications', li(f.contre_indications || []))}`;
}

/* -------------------------- recherche médicaments ---------------------- */
async function drugsView() {
  document.getElementById('app').innerHTML = `
    <a class="back" href="pathologies.html">← Pathologies</a>
    <div class="topbar"><h2>💊 Médicaments</h2></div>
    ${searchBox('qd', '🔍 DCI ou nom commercial… (ex : amoxicilline, Doliprane)')}`;
  const inp = document.getElementById('qd');
  inp.addEventListener('input', async () => {
    const q = inp.value.trim().toLowerCase();
    const box = document.getElementById('qd-res');
    if (q.length < 2) { box.innerHTML = ''; return; }
    const di = await loadDrugIdx();
    const names = await loadNames();
    const byId = {};
    for (const n of names) byId[n.id] = n;
    const out = [];
    for (const [k, v] of Object.entries(di.by_dci || {})) {
      if (k.includes(q)) out.push({ label: v.dci, type: 'DCI', fiches: v.fiches });
      if (out.length >= 20) break;
    }
    for (const [k, v] of Object.entries(di.by_brand || {})) {
      if (k.includes(q)) out.push({ label: v.brand, type: 'Princeps', fiches: v.fiches });
      if (out.length >= 40) break;
    }
    box.innerHTML = '<div class="fiche-list">' + (out.length
      ? out.map(o => {
          const fl = (o.fiches || []).slice(0, 8).map(fid => {
            const n = byId[fid];
            return n ? `<a href="pathologies.html?s=${esc(n.slug)}&id=${esc(n.id)}" style="display:inline-block;margin:2px 6px 2px 0">${esc(n.nom)}</a>` : '';
          }).join('');
          return `<div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;margin-bottom:8px;background:#fff">
            <b>${esc(o.label)}</b> <small>(${o.type})</small><br>${fl || '<small class="small">—</small>'}</div>`;
        }).join('')
      : '<p class="small">Aucun résultat.</p>') + '</div>';
  });
}
