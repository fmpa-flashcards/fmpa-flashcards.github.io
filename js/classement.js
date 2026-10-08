/* Classement hebdo / tout temps. */
import {
  requireAuth, user, profile, guardPro, fb, isoWeekId,
  esc, $, $$, tabbar, toast, saveProfile, pushLeaderboard
} from './common.js';
import { collection, query, orderBy, limit, getDocs } from '../vendor/firebase/firebase-firestore.js';

await requireAuth();
if (!guardPro('Classement', 'leaderboard')) throw new Error('locked');

const { db } = fb();
let lbTab = 'weekly';
const app = document.getElementById('app');

function tabCol() {
  return lbTab === 'weekly'
    ? collection(db, 'lb_weekly', isoWeekId(), 'users')
    : collection(db, 'lb_alltime', 'users');
}

async function renderLb() {
  const list = $('#lbList');
  if (!list) return;
  try {
    const snap = await getDocs(query(tabCol(), orderBy('xp', 'desc'), limit(50)));
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    if (!rows.length) {
      list.innerHTML = `<div class="empty">Personne pour l'instant.<br>Sois le premier à gagner de l'XP ! 🚀</div>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = rows.map((r, i) => `
      <div class="lb-row ${r.uid === user.uid ? 'me' : ''}">
        <div class="lb-rank">${medals[i] || (i + 1)}</div>
        <div class="avatar">${r.photoURL ? `<img src="${esc(r.photoURL)}" alt="">` : esc((r.nickname || '?')[0].toUpperCase())}</div>
        <div class="lb-name">${esc(r.nickname || 'Étudiant')}${r.uid === user.uid ? ' (toi)' : ''}</div>
        <div class="lb-xp">${(r.xp || 0).toLocaleString('fr-FR')} XP</div>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="empty">Classement indisponible hors-ligne.<br>Reconnecte-toi pour le voir. 📶</div>`;
  }
}

function render() {
  app.innerHTML = `
    <div class="topbar"><h2>🏆 Classement</h2></div>
    ${!profile.nickname ? `
      <div class="demo-note">👋 Choisis ton pseudo pour apparaître dans le classement :
        <div class="code-row"><input class="input" id="nickInput" placeholder="Pseudo" maxlength="30">
        <button class="btn btn-ghost" id="nickBtn" style="width:auto;margin-top:0;flex:none">OK</button></div>
      </div>` : ''}
    <div class="tabs">
      <button data-t="weekly" class="${lbTab === 'weekly' ? 'on' : ''}">Cette semaine</button>
      <button data-t="alltime" class="${lbTab === 'alltime' ? 'on' : ''}">Tout temps</button>
    </div>
    <div id="lbList"><div class="empty">Chargement…</div></div>
    <p class="small" style="text-align:center">Gagne de l'XP : QCM (jusqu'à 20 XP/question parfaite), cartes étudiées (1 XP/carte).</p>`;
  $$('.tabs button').forEach(b => b.onclick = () => { lbTab = b.dataset.t; render(); });
  const nb = $('#nickBtn');
  if (nb) nb.onclick = async () => {
    const v = $('#nickInput').value.trim().slice(0, 30);
    if (!v) return;
    saveProfile({ nickname: v });
    pushLeaderboard(true);
    toast('Pseudo enregistré ✅');
    render();
  };
  renderLb();
}

render();
document.body.insertAdjacentHTML('beforeend', tabbar('leaderboard'));
