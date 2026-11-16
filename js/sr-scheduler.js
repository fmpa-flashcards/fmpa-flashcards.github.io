/* ============================================================================
   Révision espacée — moteur d'ordonnancement (SM-2 simplifié).
   Fichier PUR : aucune dépendance (ni DOM, ni Firebase) — testable en Node.
   Partagé par js/sr.js (accueil) et js/review.js (session de révision).

   État d'une carte : [due, ivl, ease, lapses]
     due    : timestamp (ms) de la prochaine révision
     ivl    : intervalle actuel en jours (0 = jamais réussie)
     ease   : facteur de facilité (2.5 au départ, entre 1.3 et 2.8)
     lapses : nombre d'oublis sur une carte mûre (ivl >= 21 j)
   Clé d'une carte : "d{discIdx}:{topicId}:{cardIdx}"
   ============================================================================ */

export const GRADES = { AGAIN: 1, HARD: 2, GOOD: 3, EASY: 4 };
export const GRADE_LABELS = { 1: 'Encore', 2: 'Difficile', 3: 'Bien', 4: 'Facile' };

export const MIN_REVIEW_MS = 10 * 60 * 1000; // Encore → revoir dans 10 min
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MASTERED_IVL = 21;   // ivl >= 21 j  => carte maîtrisée
export const MAX_IVL = 180;       // intervalle plafonné à 180 jours
export const DEFAULT_EASE = 2.5;

/** Nouvel état après une réponse. `st` est null pour une carte jamais révisée. */
export function nextState(st, grade, now = Date.now()) {
  let ivl = st ? st[1] : 0;
  let ease = st ? st[2] : DEFAULT_EASE;
  let lapses = st ? st[3] : 0;
  const mature = ivl >= MASTERED_IVL;

  if (grade === GRADES.AGAIN) {
    ease = Math.max(1.3, +(ease - 0.2).toFixed(2));
    if (mature) lapses += 1;
    return [now + MIN_REVIEW_MS, 0, ease, lapses];
  }
  if (grade === GRADES.HARD) {
    ease = Math.max(1.3, +(ease - 0.15).toFixed(2));
    ivl = Math.max(1, Math.round(ivl * 1.2) || 1);
    if (mature) { lapses += 1; ivl = 1; }
    return [now + ivl * DAY_MS, ivl, ease, lapses];
  }
  if (grade === GRADES.GOOD) {
    ivl = st ? Math.max(1, Math.round(ivl * ease)) : 1;
    ivl = Math.min(ivl, MAX_IVL);
    return [now + ivl * DAY_MS, ivl, ease, lapses];
  }
  // Facile
  ease = Math.min(2.8, +(ease + 0.15).toFixed(2));
  ivl = st ? Math.max(1, Math.round(ivl * ease * 1.3)) : 4;
  ivl = Math.min(ivl, MAX_IVL);
  return [now + ivl * DAY_MS, ivl, ease, lapses];
}

/** Libellé du délai affiché sous chaque bouton ("< 10 min", "1 jour", "3 jours"...). */
export function intervalLabel(st, grade, now = Date.now()) {
  const [due] = nextState(st, grade, now);
  const ms = due - now;
  if (ms < 60 * 60 * 1000) return '< 10 min';
  const days = Math.round(ms / DAY_MS);
  if (days <= 1) return '1 jour';
  return `${days} jours`;
}

/** Une carte est-elle due maintenant ? */
export function isDue(st, now = Date.now()) {
  return !!st && st[0] <= now;
}

export function isMastered(st) {
  return !!st && st[1] >= MASTERED_IVL;
}

/** Statistiques globales à partir du dictionnaire des cartes. */
export function computeStats(cards, now = Date.now()) {
  let due = 0, mastered = 0, learning = 0, total = 0;
  for (const k in cards) {
    const st = cards[k];
    total += 1;
    if (isDue(st, now)) due += 1;
    else if (isMastered(st)) mastered += 1;
    else learning += 1;
  }
  const upToDate = total === 0 ? 100 : Math.round(((total - due) / total) * 100);
  return { due, mastered, learning, total, upToDate };
}

/** File d'attente : les cartes dues, de la plus en retard à la plus récente. */
export function dueQueue(cards, now = Date.now()) {
  return Object.keys(cards)
    .filter((k) => isDue(cards[k], now))
    .sort((a, b) => cards[a][0] - cards[b][0]);
}

/** Découpe une clé "d{disc}:{topicId}:{ci}" en ses parties. */
export function parseKey(key) {
  const m = /^d(\d+):([^:]+):(\d+)$/.exec(key);
  if (!m) return null;
  return { discIdx: parseInt(m[1], 10), topicId: m[2], cardIdx: parseInt(m[3], 10) };
}

export function makeKey(discIdx, topicId, cardIdx) {
  return `d${discIdx}:${topicId}:${cardIdx}`;
}
