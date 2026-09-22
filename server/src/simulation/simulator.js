// Gère les deux simulations du serveur (historique + direct) et la boucle temps réel.
import { Engine } from './engine.js';
import { config } from '../config.js';

export class Simulator {
  constructor(network) {
    this.network = network;
    this.day = 0;
    this.timer = null;

    // Journée type déjà simulée : sert de base aux analyses (cas 3 et 5)
    this.history = new Engine(network, { seed: config.seed });
    this.history.runUntil(config.serviceEndSec + 1800);

    this.live = this.createLiveDay();
  }

  // Nouvelle journée "en direct" : on simule en accéléré depuis 5h jusqu'à l'heure de démarrage
  createLiveDay() {
    const engine = new Engine(this.network, { seed: config.seed + 1 + this.day });
    engine.runUntil(config.liveStartSec);
    return engine;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.live.advance(config.simSpeed);
      // Fin de service : on repart sur une nouvelle journée
      if (this.live.clock >= config.serviceEndSec + 1800) {
        this.day += 1;
        this.live = this.createLiveDay();
      }
    }, 1000);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
  }

  // "history" (journée complète) ou "live" (journée en cours)
  engineFor(source) {
    return source === 'live' ? this.live : this.history;
  }
}
