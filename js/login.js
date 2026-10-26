/* Page de connexion — redirige vers home.html si déjà connecté.
   Page d'accueil (déconnecté) : hero Clean Premium + carte démo réelle
   (FMPA Anatomie, sujet « Vascularisation de l'encéphale : le polygone
   de Willis » t2) + formulaire de connexion avec choix de la faculté
   (chaque faculté a son propre compte et son propre abonnement — choisir
   une autre faculté redirige vers son site). */
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from '../vendor/firebase/firebase-auth.js';
import { firebaseConfig } from '../firebase-config.js';
import { $, toast, esc } from './common.js';

const FACULTIES = [
  ['fmpr', 'FMPR · Rabat', 'fmpr.flashcartes.com'],
  ['fmpa', 'FMPA · Agadir', 'fmpa.flashcartes.com'],
  ['fmpt', 'FMPT · Tanger', 'fmpt.flashcartes.com'],
  ['fmpc', 'FMPC · Casablanca', 'fmpc.flashcartes.com'],
  ['fmpo', 'FMPO · Oujda', 'fmpo.flashcartes.com'],
  ['fmpf', 'FMPF · Fès', 'fmpf.flashcartes.com'],
  ['fmpm', 'FMPM · Marrakech', 'fmpm.flashcartes.com'],
];

/* Cartes démo réelles — sujet t2 « Vascularisation de l'encéphale :
   le polygone de Willis », Anatomie FMPA. Jamais de carte inventée :
   question → réponse, tirées de disc-0.json. */
const DEMO_CARDS = [
  { q: "Qu'est-ce que le polygone de Willis ?", a: 'Le cercle artériel de la base du cerveau.', n: '1/22' },
  { q: 'Quel est le rôle du polygone de Willis ?', a: 'Un système artériel anastomotique (de suppléance) entre le territoire carotidien et le territoire vertébro-basilaire.', n: '2/22' },
  { q: 'Par quoi est formé le système carotidien à destinée encéphalique ?', a: 'Les deux artères carotides internes.', n: '4/22' },
];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const G_LOGO = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function vLogin(err, mode) {
  mode = mode || 'login';
  const isSignup = mode === 'signup';
  $('#app').innerHTML = `
    <section class="hero">
      <p class="hero-eyebrow">Flashcartes · FMPA Agadir</p>
      <h1 class="hero-title">Tout le programme de ta faculté. En flashcards.</h1>
      <p class="hero-sub">Connecte-toi pour retrouver ta progression, ton plan de la semaine et tes cartes à revoir.</p>
      <div class="demo-flip" id="demoFlip">
        <div class="demo-flip-head"><span>Aperçu — tap pour retourner</span><span id="demoCount">1 / 3</span></div>
        <div class="demo-card" id="demoCard" role="button" tabindex="0" aria-label="Carte démo, tap pour retourner">
          <div class="demo-face demo-front" id="demoFront"></div>
          <div class="demo-face demo-back" id="demoBack" hidden></div>
        </div>
        <button class="btn btn-gold" id="demoNext" type="button">Nouvelle carte →</button>
        <p class="demo-src" id="demoSrc"></p>
      </div>
      <div class="hero-stats"><span><b>443</b> sujets</span><span><b>6 861</b> cartes</span><span><b>100 DH</b> à vie</span></div>
    </section>
    <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo" aria-hidden="true"><img src="icon-512.png" alt="Flashcards" width="56" height="56"></div>
      <h1>${isSignup ? 'Créer ton compte FMPA' : 'Bon retour'}</h1>
      <p class="login-sub">Choisis ta faculté, puis ${isSignup ? 'crée ton compte' : 'connecte-toi'} pour reprendre où tu t’étais arrêté.<br><b>443 sujets · 6 861 cartes</b> · classement</p>
      <label class="fld"><span>Faculté</span>
        <select class="input" id="facSel">${FACULTIES.map(([code, label]) => `<option value="${code}"${code === 'fmpa' ? ' selected' : ''}>${label}</option>`).join('')}</select>
        <span class="fld-note">Chaque faculté a son propre compte et son propre abonnement — choisis la tienne pour te connecter au bon espace.</span></label>
      <button class="btn btn-google" id="gBtn">${G_LOGO}<span>Continuer avec Google</span></button>
      <div class="hr">ou par email</div>
      <label class="fld"><span>Email</span>
        <input class="input" id="email" type="email" placeholder="ton@email.com" autocomplete="email"></label>
      <label class="fld"><span>Mot de passe</span>
        <input class="input" id="pwd" type="password" placeholder="••••••••" autocomplete="${isSignup ? 'new-password' : 'current-password'}"></label>
      ${isSignup ? `<label class="fld"><span>Confirmer le mot de passe</span>
        <input class="input" id="pwd2" type="password" placeholder="••••••••" autocomplete="new-password"></label>` : ''}
      <div class="err" id="lerr"></div>
      ${isSignup
        ? `<button class="btn btn-primary" id="eSignup">Créer mon compte</button>
           <button class="btn btn-ghost" id="eBack">J'ai déjà un compte</button>`
        : `<button class="btn btn-primary" id="eLogin">Se connecter</button>
           <button class="btn btn-ghost" id="eSignup">Créer un compte</button>`}
      <div style="text-align:center"><button class="linklike" id="eForgot">Mot de passe oublié ?</button></div>
      <div class="login-pro"><b>Version complète — 100 DH</b> · à vie.</div>
    </div>
    </div>
    <section class="landing-feats">
      <p class="hero-eyebrow">Dans l’app</p>
      <h2 class="serif">Tout ce qu’il faut pour l’année — et pour le concours.</h2>
      <ul class="feat-list">
        <li><span class="feat-ic">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></svg>'}</span><div><b>Flashcards par sujet</b><p>Navigation par discipline et chapitre, recherche instantanée, progression sauvegardée sujet par sujet.</p></div></li>
        <li><span class="feat-ic">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>'}</span><div><b>Plan 32 semaines</b><p>Trois phases — Acquisition, Consolidation, Sprint final — avec tes tâches semaine par semaine, synchronisées sur ton compte.</p></div></li>
        <li><span class="feat-ic">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4zM7 6H4a1 1 0 0 0-1 1c0 2 1.5 3 3 3M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3-3 3"/></svg>'}</span><div><b>Classement &amp; XP</b><p>+1 XP par carte étudiée, niveaux, série de jours. Tu vois exactement où tu en es.</p></div></li>
      </ul>
    </section>`;
  /* --- carte démo : vraies cartes t2, tap pour retourner --- */
  let demoPos = 0, demoFlipped = false;
  const renderDemo = () => {
    const c = DEMO_CARDS[demoPos];
    $('#demoCount').textContent = `${demoPos + 1} / ${DEMO_CARDS.length}`;
    $('#demoFront').innerHTML = `<span class="demo-tag">Anatomie · Polygone de Willis</span><span class="demo-q">${esc(c.q)}</span><span class="demo-hint">Touche pour la réponse →</span>`;
    $('#demoBack').innerHTML = `<span class="demo-tag">Réponse</span><span class="demo-a">${esc(c.a)}</span>`;
    $('#demoFront').hidden = demoFlipped;
    $('#demoBack').hidden = !demoFlipped;
    $('#demoCard').classList.toggle('flipped', demoFlipped);
    $('#demoSrc').textContent = `Carte réelle — FMPA · Anatomie · sujet « Vascularisation de l'encéphale : le polygone de Willis » (t2), carte ${c.n}`;
  };
  const flipDemo = () => { demoFlipped = !demoFlipped; renderDemo(); };
  $('#demoCard').onclick = flipDemo;
  $('#demoCard').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipDemo(); } };
  $('#demoNext').onclick = () => { demoPos = (demoPos + 1) % DEMO_CARDS.length; demoFlipped = false; renderDemo(); };
  renderDemo();
  /* --- choix de la faculté : une autre faculté = son propre site/compte --- */
  $('#facSel').onchange = (e) => {
    const f = FACULTIES.find(([code]) => code === e.target.value);
    if (f && f[0] !== 'fmpa') location.href = 'https://' + f[2] + '/' + location.search;
  };
  const showErr = (m) => { const e = $('#lerr'); e.style.display = 'block'; e.textContent = m; };
  $('#gBtn').onclick = async () => {
    const btn = $('#gBtn');
    btn.disabled = true;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      const c = e.code || '';
      if (c.includes('popup-closed-by-user') || c.includes('cancelled-popup-request')) {
        showErr('Fenêtre Google fermée — réessaie.');
      } else if (c.includes('popup-blocked')) {
        showErr('Le navigateur a bloqué la fenêtre Google — autorise les popups pour ce site puis réessaie.');
      } else if (c.includes('account-exists-with-different-credential')) {
        showErr('Cet email a déjà un compte avec mot de passe — connecte-toi avec ton mot de passe.');
      } else {
        showErr('Connexion Google impossible : ' + e.message);
      }
    }
    btn.disabled = false;
  };
  const creds = () => {
    const email = $('#email').value.trim(), pwd = $('#pwd').value;
    if (!email || !pwd) { showErr('Entre ton email et ton mot de passe.'); return null; }
    return { email, pwd };
  };
  const friendly = (e) => {
    const c = e.code || '';
    if (c.includes('user-not-found') || c.includes('wrong-password') || c.includes('invalid-credential'))
      return 'Email ou mot de passe incorrect.';
    if (c.includes('email-already-in-use')) return 'Cet email a déjà un compte — connecte-toi.';
    if (c.includes('weak-password')) return 'Mot de passe trop court (6 caractères min).';
    if (c.includes('invalid-email')) return 'Email invalide.';
    return 'Erreur : ' + e.message;
  };
  if (isSignup) {
    $('#eSignup').onclick = async () => {
      const c = creds(); if (!c) return;
      const pwd2 = $('#pwd2').value;
      if (c.pwd !== pwd2) { showErr('Les deux mots de passe ne correspondent pas.'); return; }
      try { await createUserWithEmailAndPassword(auth, c.email, c.pwd); toast('Compte créé, bienvenue !'); }
      catch (e) { showErr(friendly(e)); }
    };
    $('#eBack').onclick = () => vLogin(null, 'login');
  } else {
    $('#eLogin').onclick = async () => {
      const c = creds(); if (!c) return;
      try { await signInWithEmailAndPassword(auth, c.email, c.pwd); }
      catch (e) { showErr(friendly(e)); }
    };
    $('#eSignup').onclick = () => vLogin(null, 'signup');
  }
  $('#eForgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) { showErr('Entre ton email pour recevoir le lien.'); return; }
    try { await sendPasswordResetEmail(auth, email); toast('Lien envoyé par email'); }
    catch (e) { showErr(friendly(e)); }
  };
  const q = new URLSearchParams(location.search).get('err');
  if (err) showErr(err);
  else if (q === 'db') showErr('Erreur de connexion à la base de données. Réessaie.');
}

(async function boot() {
  let redirectErr = null;
  try { await getRedirectResult(auth); }
  catch (e) {
    redirectErr = e.code === 'auth/account-exists-with-different-credential'
      ? 'Cet email a déjà un compte avec une autre méthode — connecte-toi avec elle.'
      : 'Connexion impossible : ' + e.message;
  }
  onAuthStateChanged(auth, (u) => {
    if (u) location.replace('home.html');
    else vLogin(redirectErr);
  });
})();
