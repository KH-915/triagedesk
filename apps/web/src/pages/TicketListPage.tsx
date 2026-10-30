import { ChangeEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, CATEGORIES, Page, PRIORITIES, STATUSES, TicketSummary } from '../api';
import { Badge } from '../components/Badge';

const LIMIT = 10;

export default function TicketListPage() {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page<TicketSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    api.listTickets({ page, limit: LIMIT, q: search, status, priority, confirmed_category: category })
      .then((r) => { if (!stale) { setResult(r); setError(null); } })
      .catch((e) => { if (!stale) setError(e.message); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [page, search, status, priority, category]);

  const pages = result ? Math.max(1, Math.ceil(result.total / result.limit)) : 1;
  const filter = (set: (v: string) => void) => (e: ChangeEvent<HTMLSelectElement>) => {
    set(e.target.value);
    setPage(1);
  };

  return (
    <>
      <div className="row">
        <h1>Tickets</h1>
        <Link className="button" to="/tickets/new">New ticket</Link>
      </div>
      <div className="filters">
        <input placeholder="Search title or body…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={status} onChange={filter(setStatus)} aria-label="Status">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={priority} onChange={filter(setPriority)} aria-label="Priority">
          <option value="">All priorities</option>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={category} onChange={filter(setCategory)} aria-label="Confirmed category">
          <option value="">All confirmed categories</option>{CATEGORIES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      {loading && !result && <p className="muted">Loading…</p>}
      {result && result.data.length === 0 && <p className="muted center">No tickets match.</p>}
      {result && result.data.length > 0 && (
        <table className={loading ? 'dim' : ''}>
          <thead>
            <tr><th>Title</th><th>Status</th><th>Priority</th><th>Suggested</th><th>Confirmed</th><th>Created</th></tr>
          </thead>
          <tbody>
            {result.data.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/tickets/${t.id}`}>{t.title}</Link></td>
                <td><Badge value={t.status} kind="status" /></td>
                <td><Badge value={t.priority} kind="priority" /></td>
                <td>
                  {t.mlStatus === 'failed'
                    ? <span className="muted">ML unavailable</span>
                    : t.predictedCategory ?? <span className="muted">…</span>}
                </td>
                <td>{t.confirmedCategory ?? <span className="muted">—</span>}</td>
                <td className="muted">{new Date(t.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result && result.total > 0 && (
        <div className="row pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span className="muted">Page {page} of {pages} · {result.total} tickets</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </>
  );
}
