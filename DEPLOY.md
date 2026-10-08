# FMPR Flashcards v2 — Guide de mise en ligne

Nouveau site complet : comptes (Google + email), progression sauvegardée dans le
cloud, QCM, classement, plan 32 semaines synchronisé, codes d'activation liés
au compte. **Statique** (Cloudflare Pages) + **Firebase** (Auth + Firestore).

```
fmpr-full/
├── index.html / styles.css / app.js   → l'application
├── firebase-config.js                 → config du projet fmpr-flashcards ✅
├── data/                              → index.json + 5 fichiers disciplines + plan.json
├── icon-192.png / icon-512.png / manifest.json / sw.js → PWA + offline
└── firestore.rules                    → règles de sécurité (à publier)
```

## Étape 1 — Créer le projet Firebase (5 min)

1. Va sur **console.firebase.google.com** → *Add project* → nomme-le `fmpr-flashcards`
   (désactive Google Analytics, inutile ici).
2. Dans le projet : **Build → Authentication → Get started**
   - Onglet *Sign-in method* → active **Google** et **Email/Password**.
3. **Project Overview → Add app → Web** (icône `</>`) → nomme-la `fmpr-web` →
   copie l'objet `firebaseConfig`. (Déjà fait — voir `firebase-config.js`.)
4. **Build → Firestore Database → Create database** → *Start in production mode*,
   région `eur3`.
5. Onglet **Rules** → colle le contenu de **`firestore.rules`** en remplaçant
   `ADMIN@EXAMPLE.COM` par ton email admin → **Publish**.

## Étape 2 — Générateur de codes privé

1. Ouvre un terminal : `cd ~/workspace/apk-build && python3 -m http.server 8000`
2. Va sur **http://localhost:8000/generateur-codes-v2.html** (fichier privé —
   ne jamais le mettre en ligne).
3. Connecte-toi avec ton compte Google admin → génère les codes et envoie-les
   aux acheteurs.
4. ⚠️ L'ancien générateur (codes liés à l'appareil) ne sert plus pour le nouveau
   site. Pour tes 4 acheteurs existants : génère-leur 4 nouveaux codes v2 et
   envoie-les leur avec le nouveau lien.

## Étape 3 — Déployer sur Cloudflare Pages (2 min)

1. **dash.cloudflare.com** → *Workers & Pages* → *Create* → *Pages* → *Upload assets*.
2. Nomme le projet (ex : `fmpr-flashcards`) → glisse-dépose **tout le contenu**
   de `fmpr-full/` (**sauf** `firestore.rules` — inutile en ligne).
3. Tu obtiens `https://fmpr-flashcards.pages.dev`.

## Étape 4 — Autoriser le domaine dans Firebase (CRITIQUE)

Sans ça, la connexion Google échoue :
**Authentication → Settings → Authorized domains → Add domain** →
ajoute `fmpr-flashcards.pages.dev` (et plus tard ton domaine perso si tu en mets un).

## Étape 5 — Checklist de test

- [ ] Créer un compte (Google + email) → arrive sur l'accueil
- [ ] Mode démo : 5 cartes/sujet, QCM/classement/plan verrouillés
- [ ] Générer un code (générateur v2) → l'entrer dans Profil → Pro activé ✅
- [ ] Rejouer un code déjà utilisé → refusé ✅
- [ ] Faire un QCM → score + XP → apparaître dans le classement
- [ ] Cocher une tâche du plan → recharger → toujours cochée
- [ ] Se connecter sur 2 appareils → le 3e déconnecte le plus ancien

## Étape 6 — APK v2 (quand le site est en ligne)

Dans `~/workspace/apk-build/app/src/main/java/com/fmpr/flashcards/MainActivity.java` :
remplacer `webView.loadUrl("file:///android_asset/flashcards.html")` par l'URL
Cloudflare Pages, ajouter `<uses-permission android:name="android.permission.INTERNET"/>`
dans le manifest, rebuild avec `build.sh` (versionCode 3).

⚠️ **Connexion Google dans l'APK** : Google bloque OAuth dans les WebView
classiques (`disallowed_useragent`). Dans l'APK, les utilisateurs devront se
connecter par **email/mot de passe** (ça marche). La connexion Google reste
disponible sur le site web (navigateur normal, iPhone, etc.).

## Notes

- **Coût : 0.** Firebase Spark (gratuit) : 50k lectures/jour, 20k écritures/jour —
  largement assez pour des centaines d'étudiants. Cloudflare Pages : gratuit,
  bande passante illimitée.
- **Offline** : le service worker met en cache le site + les données après la
  1re visite ; Firestore garde la progression en local et synchronise au retour
  du réseau. La 1re ouverture nécessite internet (téléchargement + connexion).
- **Anti-triche** : l'XP est plafonné à +600 par écriture et les codes sont à
  usage unique vérifiés côté serveur (règles). Un tricheur motivé pourrait
  gonfler son XP via la console — acceptable pour une cohorte amicale ; durcir
  plus tard avec une Cloud Function si le classement devient un vrai enjeu.
- **Ne déploie jamais** `generateur-codes-v2.html` : il contient le secret maître.
