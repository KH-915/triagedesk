export const Badge = ({ value, kind }: { value: string | null; kind: string }) =>
  value
    ? <span className={`badge ${kind}-${value}`}>{value.replace('_', ' ')}</span>
    : <span className="muted">—</span>;
