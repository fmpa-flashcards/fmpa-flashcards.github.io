/* Préparation — modules d'entraînement (pharmaco, bactério, parasito…). */
import { requireAuth, loadIndex, esc, tabbar, DISC_EMOJI, hasFull } from './common.js';

/* L'auth démarre en parallèle : le contenu (en cache) se peint sans attendre. */
requireAuth();

const idx = await loadIndex();
const prepa = idx
  .map((d, i) => ({ d, i }))
  .filter(x => x.d.section === 'prepa');

const soon = [
]; // tous les modules prévus sont en ligne

const qcmLabel = d => d.qcm
  ? `${Number(d.qcm).toLocaleString('fr-FR')} QCM`
  : '';

const cards = prepa.map(({ d, i }) => `
  <div class="disc">
    <h3>${DISC_EMOJI[i] || '📚'} ${esc(d.name)}</h3>
    <small>${d.topics} sujets · ${Number(d.cards).toLocaleString('fr-FR')} cartes${qcmLabel(d) ? ' · ' + qcmLabel(d) : ''}</small>
    <div style="display:flex;gap:8px;margin-top:10px">
      <a class="btn btn-ghost" href="discipline.html?d=${i}" style="text-decoration:none;text-align:center;flex:1">📚 Flashcards</a>
      <a class="btn ${hasFull() ? 'btn-ghost' : 'btn-primary'}" href="qcm-sujets.html?d=${i}" style="text-decoration:none;text-align:center;flex:1">✅ QCM${hasFull() ? '' : ' 🔒'}</a>
    </div>
  </div>`).join('');

const soonCards = soon.map(s => `
  <div class="disc" style="opacity:.55">
    <h3>${s.emoji} ${esc(s.name)}</h3>
    <small>Bientôt disponible</small>
  </div>`).join('');

document.getElementById('app').innerHTML = `
  <div class="topbar"><h2>🎯 Préparation</h2></div>
  <p class="small">Modules d'entraînement ciblés : flashcards + QCM d'examen.</p>
  <div class="grid">${cards}</div>
  ${soon.length ? `<div class="chapter">À venir</div><div class="grid">${soonCards}</div>` : ''}`;
document.body.insertAdjacentHTML('beforeend', tabbar('prepa'));
