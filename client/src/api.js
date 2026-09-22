// Appels vers l'API Express. En développement, Vite redirige /api vers le port 4000.

async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Erreur ${response.status}`);
  return body;
}

const post = (path, payload) => request(path, { method: 'POST', body: JSON.stringify(payload) });

export const api = {
  clock: () => request('/clock'),
  overview: () => request('/overview'),
  network: () => request('/network'),
  assumptions: () => request('/assumptions'),
  buses: () => request('/buses'),
  stops: () => request('/stops'),
  topRoutes: (source) => request(`/routes/top?source=${source}`),
  optimization: (source) => request(`/analytics/optimization?source=${source}`),
  recommend: (payload) => post('/recommendations', payload),
  crowd: (payload) => post('/recommendations/crowd', payload),
};
