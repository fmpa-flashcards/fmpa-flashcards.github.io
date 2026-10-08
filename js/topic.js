/* Sujet — mode flashcards (flip).
   La coquille (titre, carte, navigation) se peint immédiatement depuis le
   cache ; l'ordre des cartes (démo/Pro) suit dès que l'auth est prête. */
import {
  requireAuth, user, profile, isPro, hasFull, loadDisc, loadIndex, loadAllDiscs, topicEntry,
  getTP, saveTP, markSeen, hashStr, seededPick, shuffle, esc, qp, tabbar, toast, DEMO_N
} from './common.js';

/* L'auth démarre tout de suite mais ne bloque pas le premier affichage. */
const authP = requireAuth();

const topicId = qp('id');
const d = Math.max(0, parseInt(qp('d', '0'), 10) || 0);
const idx = await loadIndex();
await loadDisc(d); // only the discipline from the URL — never all five
let entry = topicEntry(topicId);
if (!entry) { await loadAllDiscs(); entry = topicEntry(topicId); } // stale ?d= fallback
if (!entry) { location.replace('home.html'); }

const discIdx = entry.discIdx;
const topic = entry.topic;
const isPrepa = idx[discIdx] && idx[discIdx].section === 'prepa';
document.title = topic.topic + ' — Flashcards FMPR';

/* Coquille immédiate — aucun écran de chargement. */
document.getElementById('app').innerHTML = `
  <a class="back" href="discipline.html?d=${discIdx}" style="text-decoration:none;display:inline-block">← ${esc(idx[discIdx].name)}</a>
  <div class="topbar"><h2 style="font-size:1.05rem">${esc(topic.topic)}</h2></div>
  <div id="demoSlot"></div>
  <div class="progress-line"><span id="fCount"></span><span id="fSeen"></span></div>
  <div class="fcard" id="fcard"><div id="ftext"></div><div class="hint" id="fhint"></div></div>
  <div class="star-row">
    <button class="iconbtn" id="fStar" title="Marquer">⭐</button>
    <button class="iconbtn" id="fShuffle" title="Mélanger">🔀</button>
  </div>
  <div class="fcard-nav">
    <button class="btn btn-ghost" id="fPrev">← Précédent</button>
    <button class="btn btn-primary" id="fNext">Suivant →</button>
  </div>
  <div id="qcmSlot"></div>`;
document.body.insertAdjacentHTML('beforeend', tabbar(isPrepa ? 'prepa' : 'home'));

const $ = (s) => document.querySelector(s);
const F = { topicId, discIdx, topic, order: null, pos: 0, flipped: false };

function renderFlip() {
  if (!F.order) return;
  const ci = F.order[F.pos];
  const card = F.topic.cards[ci];
  const box = $('#fcard');
  box.classList.toggle('flipped', F.flipped);
  $('#ftext').innerHTML = F.flipped
    ? `<div class="a">${esc(card.a)}</div>`
    : `<div class="q">${esc(card.q)}</div>`;
  $('#fhint').textContent = F.flipped ? 'Touche pour revoir la question' : 'Touche pour voir la réponse';
  $('#fCount').textContent = `Carte ${F.pos + 1}/${F.order.length}`;
  getTP(F.topicId).then(tp2 => {
    $('#fSeen').textContent = `${tp2.seen.length}/${F.topic.cards.length} vues`;
    $('#fStar').classList.toggle('on', tp2.starred.includes(ci));
  });
}

/* Dès que l'auth est prête : ordre des cartes, démo/Pro, boutons. */
authP.then(async () => {
  const tp = await getTP(topicId);
  let order;
  if (isPro()) {
    order = topic.cards.map((_, i) => i);
  } else {
    const seed = hashStr(user.uid + ':' + topicId);
    order = seededPick(topic.cards.map((_, i) => i), DEMO_N, seed).sort((a, b) => a - b);
  }
  F.order = order;

  if (!isPro()) {
    $('#demoSlot').innerHTML = `<div class="demo-note">🎁 <b>Démo :</b> ${order.length} cartes sur ${topic.cards.length}.
      <a href="profil.html" style="color:#0a5f66;font-weight:700">Tout débloquer dès 100 DH →</a></div>`;
  } else if (hasFull()) {
    $('#qcmSlot').innerHTML = `<a class="btn btn-ghost" href="qcm-setup.html?kind=topic&d=${discIdx}&id=${encodeURIComponent(topicId)}" style="text-decoration:none;text-align:center">✅ QCM sur ce sujet</a>`;
  }

  $('#fcard').onclick = () => {
    F.flipped = !F.flipped;
    if (F.flipped) markSeen(F.topicId, F.order[F.pos], F.discIdx);
    renderFlip();
  };
  $('#fPrev').onclick = () => { F.pos = (F.pos - 1 + F.order.length) % F.order.length; F.flipped = false; renderFlip(); };
  $('#fNext').onclick = () => { F.pos = (F.pos + 1) % F.order.length; F.flipped = false; renderFlip(); };
  $('#fShuffle').onclick = () => {
    F.order = shuffle(F.order);
    F.pos = 0; F.flipped = false;
    renderFlip();
    toast('Mélangé 🔀');
  };
  $('#fStar').onclick = async () => {
    const ci = F.order[F.pos];
    const tp2 = await getTP(F.topicId);
    const ix = tp2.starred.indexOf(ci);
    if (ix >= 0) tp2.starred.splice(ix, 1); else tp2.starred.push(ci);
    saveTP(F.topicId);
    renderFlip();
  };
  renderFlip();
}).catch(() => {});
