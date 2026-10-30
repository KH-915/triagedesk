import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, CATEGORIES, Priority, PRIORITIES, Status, Ticket, TRANSITIONS } from '../api';
import { useAuth } from '../auth';
import { Badge } from '../components/Badge';

type Patch = Parameters<typeof api.updateTicket>[1];

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isAgent = user?.role === 'AGENT';

  useEffect(() => {
    api.getTicket(id!).then(setTicket).catch((e) => setError(e.message));
  }, [id]);

  async function patch(p: Patch) {
    setSaving(true);
    setError(null);
    try { setTicket(await api.updateTicket(id!, p)); }
    catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }

  if (error && !ticket) return <><p className="error" role="alert">{error}</p><Link to="/">Back</Link></>;
  if (!ticket) return <p className="muted">Loading…</p>;

  const nextStatuses = TRANSITIONS[ticket.status];

  return (
    <div className="card">
      <Link to="/">← All tickets</Link>
      <h1>{ticket.title}</h1>
      <p className="body">{ticket.body}</p>
      {error && <p className="error" role="alert">{error}</p>}

      <dl>
        <dt>Status</dt><dd><Badge value={ticket.status} kind="status" /></dd>
        <dt>Priority</dt><dd><Badge value={ticket.priority} kind="priority" /></dd>
        <dt>ML suggestion</dt>
        <dd>
          {ticket.mlStatus === 'success' && (
            <>{ticket.predictedCategory} <span className="muted">
              ({Math.round((ticket.confidenceScore ?? 0) * 100)}% confidence · model {ticket.modelVersion})
            </span></>
          )}
          {ticket.mlStatus === 'failed' && <span className="muted">ML service was unavailable — triage manually.</span>}
          {ticket.mlStatus === 'pending' && <span className="muted">Pending</span>}
        </dd>
        <dt>Confirmed category</dt>
        <dd>{ticket.confirmedCategory ?? <span className="muted">Not yet confirmed</span>}</dd>
      </dl>

      {isAgent ? (
        <fieldset disabled={saving}>
          <legend>Agent actions</legend>
          <label>Category
            <select value={ticket.confirmedCategory ?? ''}
              onChange={(e) => e.target.value && patch({ confirmed_category: e.target.value })}>
              <option value="">Select…</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {ticket.predictedCategory && ticket.confirmedCategory !== ticket.predictedCategory && (
            <button type="button" onClick={() => patch({ confirmed_category: ticket.predictedCategory! })}>
              Accept suggestion "{ticket.predictedCategory}"
            </button>
          )}
          <label>Priority
            <select value={ticket.priority ?? ''}
              onChange={(e) => e.target.value && patch({ priority: e.target.value as Priority })}>
              <option value="">Select…</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </label>
          <label>Move to status
            <select value="" disabled={nextStatuses.length === 0}
              onChange={(e) => e.target.value && patch({ status: e.target.value as Status })}>
              <option value="">{nextStatuses.length ? 'Select…' : 'Closed (final)'}</option>
              {nextStatuses.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </fieldset>
      ) : (
        <p className="muted">Only support agents can confirm categories, set priority or change status.</p>
      )}
    </div>
  );
}
