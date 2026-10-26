/* Sujet — mode flashcards (flip).
   La coquille (titre, carte, navigation) se peint immédiatement depuis le
   cache ; l'ordre des cartes (démo/Pro) suit dès que l'auth est prête. */
import {
  requireAuth, user, profile, isPro, loadDisc, loadIndex, loadAllDiscs, topicEntry,
  getTP, saveTP, markSeen, shuffle, esc, qp, tabbar, toast, DEMO_N
} from './common.js';

/* L'auth démarre tout de suite mais ne bloque pas le premier affichage. */
const authP = requireAuth();

const topicId = qp('id');
const d = Math.max(0, parseInt(qp('d', '0'), 10) || 0);
const startCard = Math.max(0, parseInt(qp('c', '0'), 10) || 0);
const idx = await loadIndex();
await loadDisc(d); // only the discipline from the URL — never all five
let entry = topicEntry(topicId);
if (!entry) { await loadAllDiscs(); entry = topicEntry(topicId); } // stale ?d= fallback
if (!entry) { location.replace('home.html'); }

const discIdx = entry.discIdx;
const topic = entry.topic;
const isPrepa = idx[discIdx] && idx[discIdx].section === 'prepa';
document.title = topic.topic + ' — Flashcards FMPA';

/* Coquille immédiate — aucun écran de chargement. */
document.getElementById('app').innerHTML = `
  <a class="back" href="discipline.html?d=${discIdx}" style="text-decoration:none;display:inline-block">← ${esc(idx[discIdx].name)}</a>
  <div class="topbar"><h2 style="font-size:1.05rem">${esc(topic.topic)}</h2></div>
  <div id="demoSlot"></div>
  <div class="progress-line"><span id="fCount"></span><span id="fSeen"></span></div>
  <div class="fcard" id="fcard">
    <div class="fcard-face" id="fFront"><div class="q" id="fQ"></div><div class="hint" id="fHintQ">Touche pour voir la réponse</div></div>
    <div class="fcard-face" id="fBack" hidden><div class="a" id="fA"></div><div class="hint" id="fHintA">Touche pour revoir la question</div></div>
  </div>
  <div class="star-row">
    <button class="iconbtn" id="fStar" title="Marquer" aria-label="Marquer cette carte"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3.5 14.7 8.6 20.3 9.4 16.2 13.3 17.2 18.9 12 16.2 6.8 18.9 7.8 13.3 3.7 9.4 9.3 8.6Z"/></svg></button>
    <button class="iconbtn" id="fShuffle" title="Mélanger" aria-label="Mélanger les cartes"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></button>
  </div>
  <div class="fcard-nav">
    <button class="btn btn-ghost" id="fPrev">← Précédent</button>
    <button class="btn btn-primary" id="fNext">Suivant →</button>
  </div>`;
document.body.insertAdjacentHTML('beforeend', tabbar(isPrepa ? 'prepa' : 'home'));

const $ = (s) => document.querySelector(s);
const F = { topicId, discIdx, topic, order: null, pos: 0, flipped: false };

function renderFlip() {
  if (!F.order) return;
  const ci = F.order[F.pos];
  const card = F.topic.cards[ci];
  const box = $('#fcard');
  box.classList.toggle('flipped', F.flipped);
  $('#fQ').textContent = card.q;
  $('#fA').textContent = card.a;
  $('#fFront').hidden = F.flipped;
  $('#fBack').hidden = !F.flipped;
  $('#fCount').textContent = `Carte ${F.pos + 1}/${F.order.length}`;
  /* « Reprendre » sur l'accueil : mémorise le dernier sujet étudié. */
  try {
    localStorage.setItem('fmpa_resume', JSON.stringify({
      d: F.discIdx, id: F.topicId, title: F.topic.topic,
      discName: idx[F.discIdx] ? idx[F.discIdx].name : '',
      pos: F.pos, total: F.order.length, ts: Date.now(),
    }));
  } catch (e) {}
  getTP(F.topicId).then(tp2 => {
    $('#fSeen').textContent = `${tp2.seen.length}/${F.topic.cards.length} vues`;
    $('#fStar').classList.toggle('on', tp2.starred.includes(ci));
  });
}

/* Dès que l'auth est prête : ordre des cartes, démo/Pro, boutons. */
let authDone = false;
authP.then(async () => {
  authDone = true;
  const tp = await getTP(topicId);
  let order;
  if (isPro()) {
    order = topic.cards.map((_, i) => i);
  } else {
    order = topic.cards.map((_, i) => i).slice(0, DEMO_N);
  }
  F.order = order;
  F.pos = Math.min(startCard, Math.max(0, order.length - 1));

  if (!isPro()) {
    $('#demoSlot').innerHTML = `<div class="demo-note"><b>Démo :</b> ${order.length} cartes sur ${topic.cards.length}.
      <a href="profil.html" style="color:#0a5f66;font-weight:700">Tout débloquer dès 100 DH →</a></div>`;
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
    toast('Mélangé');
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

/* Fallback: si l'auth traîne (réseau lent), afficher les cartes quand même. */
setTimeout(() => {
  if (!authDone && !F.order) {
    F.order = topic.cards.map((_, i) => i);
    $('#fcard').onclick = () => { F.flipped = !F.flipped; renderFlip(); };
    $('#fPrev').onclick = () => { F.pos = (F.pos - 1 + F.order.length) % F.order.length; F.flipped = false; renderFlip(); };
    $('#fNext').onclick = () => { F.pos = (F.pos + 1) % F.order.length; F.flipped = false; renderFlip(); };
    renderFlip();
  }
}, 8000);
