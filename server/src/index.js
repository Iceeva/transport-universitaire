// Point d'entrée du serveur Express.
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { buildNetwork } from './simulation/network.js';
import { Simulator } from './simulation/simulator.js';
import { createApiRouter } from './routes/api.js';

const network = buildNetwork();
const simulator = new Simulator(network);
simulator.start();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', createApiRouter(simulator));

// Si le front a été compilé (npm run build), Express le sert directement
const distDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// Gestion d'erreurs centralisée
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Erreur interne' });
});

app.listen(config.port, () => {
  console.log(`API transport universitaire sur http://localhost:${config.port}`);
  console.log(`Simulation en direct : x${config.simSpeed}`);
});
