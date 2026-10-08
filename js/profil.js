/* Profil : stats, Pro, appareils, déconnexion. */
import {
  requireAuth, user, profile, fb, levelFor,
  esc, $, $$, tabbar, toast, signOutAll,
  waUnlockLink, bindRedeem, listSessions,
  REF_COMMISSION, REF_MIN_WITHDRAW, WA_NUMBER
} from './common.js';
import { doc, deleteDoc } from '../vendor/firebase/firebase-firestore.js';

await requireAuth();

const { db } = fb();
const p = profile;
const acc = p.mcqTotal ? Math.round(p.mcqCorrect / p.mcqTotal * 100) : 0;
const lvl = levelFor(p.xp || 0);
const app = document.getElementById('app');
const refLink = 'https://fmpr-flashcards.pages.dev/?ref=' + encodeURIComponent(p.referralCode || '');
const refBalance = p.refBalance || 0;
const refCount = p.refCount || 0;
const canWithdraw = refBalance >= REF_MIN_WITHDRAW;

app.innerHTML = `
  <div class="topbar"><h2>👤 Profil</h2></div>
  <div class="kv">
    <div class="r"><span class="k">Compte</span><span class="v">${esc(p.displayName || '')}</span></div>
    <div class="r"><span class="k">Email</span><span class="v" style="font-size:.8rem">${esc(p.email || '')}</span></div>
    <div class="r"><span class="k">Statut</span><span class="v">${p.proTier === 'full' ? '<span class="badge">⭐ FULL</span>' : p.proTier === 'cards' ? '<span class="badge">🃏 CARTES</span>' : 'Démo'}</span></div>
    <div class="r"><span class="k">Pseudo (classement)</span>
      <span class="v"><a href="classement.html" style="color:var(--teal)">${esc(p.nickname || 'définir →')}</a></span></div>
  </div>
  <div class="kv">
    <div class="r"><span class="k">Niveau</span><span class="v">${lvl} (${(p.xp || 0).toLocaleString('fr-FR')} XP)</span></div>
    <div class="r"><span class="k">🔥 Série</span><span class="v">${p.streak || 0} jour(s)</span></div>
    <div class="r"><span class="k">🃏 Cartes vues</span><span class="v">${(p.cardsSeen || 0).toLocaleString('fr-FR')}</span></div>
    <div class="r"><span class="k">✅ QCM parfaits</span><span class="v">${p.mcqCorrect || 0}/${p.mcqTotal || 0} (${acc}%)</span></div>
  </div>
  ${p.proTier ? '' : `
  <div class="lock" style="margin-top:0">
    <div class="big">🚀</div>
    <h2>Choisis ta formule</h2>
    <div style="display:flex;gap:10px;margin:12px 0">
      <div style="flex:1;border:2px solid #e0f2f4;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.4rem">🃏</div>
        <b>Cartes — 100 DH</b>
        <div class="small">8 260 cartes illimitées<br>classement · plan</div>
      </div>
      <div style="flex:1;border:2px solid #0e7c86;border-radius:12px;padding:12px;text-align:center">
        <div style="font-size:1.4rem">⭐</div>
        <b>Full — 150 DH</b>
        <div class="small">Tout + 21 600 QCM<br>classement · plan</div>
      </div>
    </div>
    <p class="small">Paiement unique, à vie.</p>
    <a class="btn btn-primary" href="${waUnlockLink()}" target="_blank" rel="noopener" style="text-decoration:none">💬 Commander sur WhatsApp</a>
    <div class="hr">ou entre ton code d'activation</div>
    <div class="code-row">
      <input class="input" id="redeemInput" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off">
      <button class="btn btn-ghost" id="redeemBtn" style="width:auto;margin-top:0;flex:none">OK</button>
    </div>
  </div>`}
  <div class="kv mt">
    <div class="r"><span class="k"><b>🎁 Parrainage</b></span><span class="v small">${REF_COMMISSION} DH par ami</span></div>
    <div class="r"><span class="k">Ton lien</span>
      <span class="v"><button class="linklike" id="copyRef" style="font-size:.75rem;word-break:break-all">${esc(refLink)}</button></span></div>
    <div class="r"><span class="k">👥 Filleuls</span><span class="v"><b>${refCount}</b></span></div>
    <div class="r"><span class="k">💰 Solde</span><span class="v"><b>${refBalance} DH</b></span></div>
  </div>
  ${canWithdraw
    ? `<a class="btn btn-primary" id="waWithdraw" href="https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Salam, je veux retirer mon solde FMPR : ' + refBalance + ' DH (' + refCount + ' filleul(s)). Mon code parrain : ' + (p.referralCode || ''))}" target="_blank" rel="noopener" style="text-decoration:none">💸 Retirer via WhatsApp (${refBalance} DH)</a>`
    : `<p class="small" style="text-align:center;color:#5b6b7c">Retrait possible dès ${REF_MIN_WITHDRAW} DH — partage ton lien !</p>`}
  <div class="kv mt">
    <div class="r"><span class="k"><b>📱 Mes appareils</b></span><span class="v small">max 2 connectés</span></div>
    <div id="sessList"><div class="small">Chargement…</div></div>
  </div>
  <button class="btn btn-ghost" id="signout">Se déconnecter</button>`;

bindRedeem();
document.body.insertAdjacentHTML('beforeend', tabbar('profile'));

$('#signout').onclick = () => signOutAll();
$('#copyRef').onclick = async () => {
  try { await navigator.clipboard.writeText(refLink); toast('Lien copié ! Partage-le à tes amis 🎉'); }
  catch (e) { toast(refLink); }
};

const sessions = await listSessions();
const mySid = sessionStorage.getItem('fmpr_sid');
$('#sessList').innerHTML = sessions.length ? sessions.map(s => {
  const me = s.id === mySid;
  const when = s.lastSeen && s.lastSeen.toDate ? s.lastSeen.toDate().toLocaleString('fr-FR') : '…';
  return `<div class="r"><span class="k" style="font-size:.78rem">${me ? '📱 Cet appareil' : '📲 Appareil'}<br><span class="small">${esc(when)}</span></span>
    <span class="v">${me ? '' : `<button class="linklike" data-rev="${s.id}">déconnecter</button>`}</span></div>`;
}).join('') : '<div class="small">Aucun appareil.</div>';
$$('[data-rev]').forEach(b => b.onclick = async () => {
  await deleteDoc(doc(db, 'users', user.uid, 'sessions', b.dataset.rev));
  toast('Appareil déconnecté.');
  location.reload();
});
