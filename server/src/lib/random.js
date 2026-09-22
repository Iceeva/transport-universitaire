// Générateur pseudo-aléatoire avec graine (mulberry32).
// Avantage : les données simulées sont reproductibles d'un lancement à l'autre.

export function createRandom(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Entier entre min et max inclus
  function int(min, max) {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  // Tirage pondéré : items = tableau, weightOf(item) = poids
  function weighted(items, weightOf) {
    const total = items.reduce((sum, item) => sum + weightOf(item), 0);
    let r = next() * total;
    for (const item of items) {
      r -= weightOf(item);
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }

  // Loi de Poisson (algorithme de Knuth) : nombre d'arrivées pendant un pas de temps
  function poisson(lambda) {
    if (lambda <= 0) return 0;
    const limit = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k += 1;
      p *= next();
    } while (p > limit);
    return k - 1;
  }

  return { next, int, weighted, poisson };
}
