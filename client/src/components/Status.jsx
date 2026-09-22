// Petits composants d'état : chargement et erreur.
export function Loading({ text = 'Chargement...' }) {
  return (
    <div className="text-center text-muted py-4">
      <div className="spinner-border spinner-border-sm me-2" role="status" />
      {text}
    </div>
  );
}

export function ErrorMessage({ message }) {
  if (!message) return null;
  return (
    <div className="alert alert-danger d-flex align-items-center" role="alert">
      <i className="bi bi-exclamation-triangle me-2" />
      <div>
        {message}
        <div className="small">Le serveur est-il bien lancé ? (voir README)</div>
      </div>
    </div>
  );
}
