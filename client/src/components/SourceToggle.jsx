// Choix de la source des analyses : journée type simulée ou journée en cours.
export default function SourceToggle({ value, onChange }) {
  return (
    <div className="btn-group btn-group-sm" role="group">
      <button
        type="button"
        className={`btn ${value === 'history' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onChange('history')}
      >
        <i className="bi bi-calendar-week me-1" />
        Journée type (complète)
      </button>
      <button
        type="button"
        className={`btn ${value === 'live' ? 'btn-primary' : 'btn-outline-primary'}`}
        onClick={() => onChange('live')}
      >
        <i className="bi bi-lightning-charge me-1" />
        Aujourd'hui (en cours)
      </button>
    </div>
  );
}
