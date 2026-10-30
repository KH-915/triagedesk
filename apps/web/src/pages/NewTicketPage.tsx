import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, api } from '../api';

export default function NewTicketPage() {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const t = await api.createTicket(title, body);
      nav(`/tickets/${t.id}`);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.fields ? Object.values(ae.fields).join('; ') : ae.message);
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>New ticket</h1>
      <label>Title
        <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>Description
        <textarea required rows={6} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Submitting…' : 'Submit ticket'}</button>
    </form>
  );
}
