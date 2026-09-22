// Pastille colorée pour une ligne de bus.
export default function LineBadge({ id, color }) {
  return (
    <span className="line-badge" style={{ background: color }}>
      {id}
    </span>
  );
}
