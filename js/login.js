/* Page de connexion — redirige vers home.html si déjà connecté. */
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from '../vendor/firebase/firebase-auth.js';
import { firebaseConfig } from '../firebase-config.js';
import { $, toast } from './common.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const G_LOGO = `<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

function vLogin(err) {
  $('#app').innerHTML = `
    <div class="login-wrap">
    <div class="login-card">
      <div class="login-logo">🩺</div>
      <h1>Flashcards FMPA</h1>
      <p class="login-sub">13 290 flashcards · classement<br>Ta progression sauvegardée partout.</p>
      <button class="btn btn-google" id="gBtn">${G_LOGO}<span>Continuer avec Google</span></button>
      <div class="hr">ou par email</div>
      <label class="fld"><span>Email</span>
        <input class="input" id="email" type="email" placeholder="ton@email.com" autocomplete="email"></label>
      <label class="fld"><span>Mot de passe</span>
        <input class="input" id="pwd" type="password" placeholder="••••••••" autocomplete="current-password"></label>
      <div class="err" id="lerr"></div>
      <button class="btn btn-primary" id="eLogin">Se connecter</button>
      <button class="btn btn-ghost" id="eSignup">Créer un compte</button>
      <div style="text-align:center"><button class="linklike" id="eForgot">Mot de passe oublié ?</button></div>
      <div class="login-pro">⭐ <b>Version complète — 100 DH</b> · à vie.</div>
    </div>
    </div>`;
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
  $('#eLogin').onclick = async () => {
    const c = creds(); if (!c) return;
    try { await signInWithEmailAndPassword(auth, c.email, c.pwd); }
    catch (e) { showErr(friendly(e)); }
  };
  $('#eSignup').onclick = async () => {
    const c = creds(); if (!c) return;
    try { await createUserWithEmailAndPassword(auth, c.email, c.pwd); toast('Compte créé, bienvenue ! 🎉'); }
    catch (e) { showErr(friendly(e)); }
  };
  $('#eForgot').onclick = async () => {
    const email = $('#email').value.trim();
    if (!email) { showErr('Entre ton email pour recevoir le lien.'); return; }
    try { await sendPasswordResetEmail(auth, email); toast('Lien envoyé par email ✉️'); }
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
