// Formatage des heures simulées et petits utilitaires d'arrondi.

export function formatClock(seconds) {
  const total = Math.floor(seconds) % 86400;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const round1 = (n) => Math.round(n * 10) / 10;
export const toMin = (sec) => Math.round((sec / 60) * 10) / 10;
