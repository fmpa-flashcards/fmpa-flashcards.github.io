// ============================================================================
//  FMPR Flashcards — configuration Firebase (projet réel)
//  Projet : fmpr-flashcards | Compte : anzajewls@gmail.com
// ============================================================================
export const firebaseConfig = {
  apiKey: "AIzaSyA5nEYGxXgALKBDFAnvQFDCyaAcNcL9quA",
  authDomain: "fmpr-flashcards.firebaseapp.com",
  projectId: "fmpr-flashcards",
  storageBucket: "fmpr-flashcards.firebasestorage.app",
  messagingSenderId: "61524543799",
  appId: "1:61524543799:web:1cfbc2d9a7afa8176d32b2"
};

// Email de l'administrateur — seul cet email peut générer des codes.
// DOIT correspondre à la valeur isAdmin() dans firestore.rules
export const ADMIN_EMAIL = "anzajewls@gmail.com";
