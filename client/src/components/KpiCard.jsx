// Carte d'indicateur : icône encadrée, valeur, libellé.
const VARIANT_STYLE = {
  primary: { bg: '#e7edf4', fg: '#1c3f66' },
  success: { bg: '#e5f2ea', fg: '#2f7d52' },
  warning: { bg: '#faedde', fg: '#c8792a' },
  danger: { bg: '#f7e7e7', fg: '#b23b3b' },
};

export default function KpiCard({ icon, label, value, hint, variant = 'primary' }) {
  const style = VARIANT_STYLE[variant] || VARIANT_STYLE.primary;
  return (
    <div className="card h-100">
      <div className="card-body d-flex align-items-center">
        <div className="kpi-icon me-3" style={{ background: style.bg, color: style.fg }}>
          <i className={`bi ${icon}`} />
        </div>
        <div>
          <div className="kpi-value">{value}</div>
          <div className="text-muted small">{label}</div>
          {hint && <div className="text-muted small">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
