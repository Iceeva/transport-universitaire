// Barre de remplissage : verte < 60 %, orange < 90 %, rouge au-delà.
export function fillVariant(value) {
  if (value >= 90) return 'danger';
  if (value >= 60) return 'warning';
  return 'success';
}

export default function FillBar({ value, height = 18 }) {
  const rounded = Math.round(value * 10) / 10;
  return (
    <div className="progress" style={{ height }} title={`${rounded} %`}>
      <div
        className={`progress-bar bg-${fillVariant(value)}`}
        role="progressbar"
        style={{ width: `${Math.min(100, value)}%` }}
      >
        {value >= 15 ? `${Math.round(value)} %` : ''}
      </div>
      {value < 15 && <span className="ms-2 small align-self-center">{Math.round(value)} %</span>}
    </div>
  );
}
