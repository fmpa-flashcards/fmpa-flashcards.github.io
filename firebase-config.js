// ============================================================================
//  FMPA Flashcards — configuration Firebase (projet dédié)
//  Projet : fmpa-flashcards | Compte : anzajewls@gmail.com
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDex6lZqD5GTG8Kod_GHEavF7xKsgjFrdY",
  authDomain: "fmpa-flashcards.firebaseapp.com",
  projectId: "fmpa-flashcards",
  storageBucket: "fmpa-flashcards.firebasestorage.app",
  messagingSenderId: "540562510232",
  appId: "1:540562510232:web:0e016f3b09e92157791bed"
};

// Email de l'administrateur — seul cet email peut générer des codes.
// DOIT correspondre à la valeur isAdmin() dans firestore.rules
export const ADMIN_EMAIL = "anzajewls@gmail.com";
