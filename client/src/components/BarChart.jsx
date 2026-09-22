// Histogramme minimaliste en HTML/CSS (aucune librairie de graphiques).
// items : [{ label, value, highlight }]
export default function BarChart({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="chart">
      {items.map((item) => (
        <div className="chart-col" key={item.label} title={`${item.label} : ${item.value}`}>
          <span className="chart-value">{item.value}</span>
          <div
            className={`chart-bar ${item.highlight ? 'highlight' : ''}`}
            style={{ height: `${(item.value / max) * 75}%` }}
          />
          <span className="chart-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
