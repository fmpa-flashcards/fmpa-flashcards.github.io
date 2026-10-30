/* Atlas Imagerie — promo intégrée à l'accueil :
   - bouton « Atlas Imagerie » dans la barre du haut (toujours visible)
   - carte Atlas Imagerie sur l'accueil (toujours visible)
   - popup à la connexion pour les membres Pro (une fois, fermable)
   Module autonome et défensif : il ne doit jamais casser l'app hôte. */
import { requireAuth, isPro } from './common.js';

const SCAN_URL = 'https://scan.flashcartes.com';
const SEEN_KEY = 'atlasPromoV1Seen';

const CSS = `
.atlas-pill{display:inline-flex;align-items:center;gap:6px;background:#0e7c7b;color:#fff;
  font-weight:800;font-size:.78rem;text-decoration:none;border-radius:999px;padding:7px 12px;
  white-space:nowrap;box-shadow:0 4px 12px rgba(14,124,123,.35)}
.atlas-pill .dot{width:7px;height:7px;border-radius:50%;background:#f5c542}
.atlas-card{display:block;text-decoration:none;border-radius:18px;padding:18px;margin:0 0 14px;
  background:linear-gradient(135deg,#0e2a44,#0e7c7b);color:#fff;
  box-shadow:0 12px 26px rgba(14,42,68,.25)}
.atlas-card .a-tag{display:inline-block;background:#c19a4b;color:#fff;font-size:.62rem;
  font-weight:800;letter-spacing:.12em;border-radius:99px;padding:3px 8px;margin-bottom:8px}
.atlas-card h3{margin:0 0 6px;font-size:1.25rem;color:#fff}
.atlas-card p{margin:0 0 10px;font-size:.88rem;line-height:1.5;color:#cfe3e2}
.atlas-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:13px}
.atlas-chips span{background:rgba(255,255,255,.14);border-radius:99px;padding:4px 10px;
  font-size:.72rem;font-weight:700}
.atlas-card .a-btn{display:inline-block;background:#fff;color:#0e2a44;font-weight:800;
  border-radius:11px;padding:10px 15px;font-size:.9rem}
.atlas-overlay{position:fixed;inset:0;background:rgba(8,18,30,.62);z-index:999;
  display:flex;align-items:flex-end;justify-content:center;padding:14px}
.atlas-popup{background:#fff;border-radius:20px;max-width:430px;width:100%;padding:22px 20px;
  color:#12263c;box-shadow:0 24px 60px rgba(0,0,0,.35);position:relative;
  animation:atlasUp .28s ease}
@keyframes atlasUp{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
.atlas-popup .a-tag{display:inline-block;background:#fdf3dc;color:#8a6d1f;font-size:.64rem;
  font-weight:800;letter-spacing:.12em;border-radius:99px;padding:4px 9px;margin-bottom:9px}
.atlas-popup h3{margin:0 0 7px;font-size:1.3rem}
.atlas-popup p{margin:0 0 12px;font-size:.92rem;line-height:1.55;color:#43586e}
.atlas-popup .atlas-chips span{background:#eef4f4;color:#0e4f4e}
.atlas-popup .a-cta{display:block;text-align:center;background:#0e7c7b;color:#fff;font-weight:800;
  text-decoration:none;border-radius:12px;padding:13px;font-size:.98rem;margin-bottom:8px}
.atlas-popup .a-later{display:block;width:100%;text-align:center;background:none;border:0;
  color:#5b6b7c;font-weight:700;font-size:.9rem;padding:8px;cursor:pointer}
.atlas-popup .a-x{position:absolute;top:10px;right:12px;background:none;border:0;font-size:1.15rem;
  color:#8aa0b4;cursor:pointer;padding:6px}
`;

function injectStyle() {
  if (document.getElementById('atlasPromoStyle')) return;
  const st = document.createElement('style');
  st.id = 'atlasPromoStyle';
  st.textContent = CSS;
  document.head.appendChild(st);
}

function chipsHtml() {
  return `<div class="atlas-chips"><span>Scanner · 107 cas</span><span>Radio · 198 cas</span><span>Écho · 110 cas</span></div>`;
}

function insertPillAndCard() {
  const topbar = document.querySelector('.topbar');
  if (topbar && !document.querySelector('.atlas-pill')) {
    const pill = document.createElement('a');
    pill.className = 'atlas-pill';
    pill.href = SCAN_URL;
    pill.target = '_blank';
    pill.rel = 'noopener';
    pill.innerHTML = `<span class="dot"></span>Atlas Imagerie`;
    const streak = topbar.querySelector('.streak');
    if (streak) topbar.insertBefore(pill, streak);
    else topbar.appendChild(pill);
  }
  if (!document.querySelector('.atlas-card')) {
    const card = document.createElement('a');
    card.className = 'atlas-card';
    card.href = SCAN_URL;
    card.target = '_blank';
    card.rel = 'noopener';
    card.innerHTML = `<span class="a-tag">NOUVEAU</span>
      <h3>Atlas Imagerie</h3>
      <p>415 cas réels de scanner, radiographie et échographie, avec les annotations des experts. Inclus pour les membres Pro — même compte que tes flashcards.</p>
      ${chipsHtml()}
      <span class="a-btn">Ouvrir Atlas Imagerie</span>`;
    const anchor = document.getElementById('resumeSlot') || document.querySelector('.xpbar');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
    else {
      const app = document.getElementById('app');
      if (app) app.appendChild(card);
    }
  }
}

function showPopup() {
  if (document.querySelector('.atlas-overlay')) return;
  const ov = document.createElement('div');
  ov.className = 'atlas-overlay';
  ov.innerHTML = `<div class="atlas-popup" role="dialog" aria-label="Atlas Imagerie">
    <button class="a-x" type="button" aria-label="Fermer">✕</button>
    <span class="a-tag">INCLUS — MEMBRES PRO</span>
    <h3>Atlas Imagerie est arrivé</h3>
    <p>415 cas réels — scanner, radiographie et échographie — avec les annotations des experts, déjà inclus dans ton abonnement Pro.</p>
    ${chipsHtml()}
    <a class="a-cta" href="${SCAN_URL}" target="_blank" rel="noopener">Découvrir Atlas Imagerie</a>
    <button class="a-later" type="button">Plus tard</button>
  </div>`;
  const close = () => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    ov.remove();
  };
  ov.querySelector('.a-x').addEventListener('click', close);
  ov.querySelector('.a-later').addEventListener('click', close);
  ov.querySelector('.a-cta').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.body.appendChild(ov);
}

function init() {
  injectStyle();
  /* La page d'accueil rend son contenu de façon asynchrone : on attend
     la barre du haut (max ~12 s) avant d'insérer bouton + carte. */
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (document.querySelector('.topbar') || tries > 80) {
      clearInterval(timer);
      try { insertPillAndCard(); } catch (e) {}
    }
  }, 150);
  /* Popup : uniquement pour les Pro, une fois (clé versionnée). */
  let seen = false;
  try { seen = !!localStorage.getItem(SEEN_KEY); } catch (e) {}
  if (!seen) {
    requireAuth()
      .then(() => {
        let pro = false;
        try { pro = !!isPro(); } catch (e) {}
        if (pro) setTimeout(() => { try { showPopup(); } catch (e) {} }, 700);
      })
      .catch(() => {});
  }
}

try { init(); } catch (e) {}
