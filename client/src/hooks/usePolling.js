import { useEffect, useState } from 'react';

// Appelle `fetcher` au chargement puis toutes les `intervalMs` millisecondes (0 = une seule fois).
// `deps` : quand une de ces valeurs change, on recharge.
export function usePolling(fetcher, intervalMs = 0, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetcher();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (err) {
        if (!cancelled) setState((old) => ({ ...old, error: err.message, loading: false }));
      }
    }

    load();
    const timer = intervalMs > 0 ? setInterval(load, intervalMs) : null;
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
