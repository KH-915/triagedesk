import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, ImportResult, api } from '../api';

const TEMPLATE =
  'title,body,priority\n' +
  'Cannot log in,"I reset my password but the email never arrives.",high\n' +
  'Charged twice,I see two charges for the same order on my card.,\n';
const TEMPLATE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;

export default function ImportTicketsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setResult(await api.importTickets(file));
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  // Row errors come back as fields keyed "row N"; anything else is a whole-file error.
  const rowErrors = Object.entries(error?.fields ?? {});

  return (
    <div className="card">
      <Link to="/">← All tickets</Link>
      <h1>Import tickets</h1>
      <p className="muted">
        Upload a .csv or .xlsx file (first sheet) with a header row. Columns: <b>title</b>,{' '}
        <b>body</b> (or <b>description</b>), and optional <b>priority</b> (low, medium, high,
        critical). Up to 1000 rows and 5 MB. If any row is invalid, nothing is imported.{' '}
        <a href={TEMPLATE_HREF} download="tickets-template.csv">Download a template</a>.
      </p>

      <form onSubmit={submit}>
        <label>File
          <input
            type="file"
            accept=".csv,.xlsx"
            required
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setError(null); }}
          />
        </label>
        <button disabled={!file || busy}>{busy ? 'Importing…' : 'Import'}</button>
      </form>

      {result && (
        <p role="status">
          Imported {result.imported} ticket{result.imported === 1 ? '' : 's'}.{' '}
          {result.mlStatus === 'failed' && 'The ML service was unavailable, so they have no suggested category. '}
          <Link to="/">View tickets</Link>
        </p>
      )}

      {error && <p className="error" role="alert">{error.message}</p>}
      {rowErrors.length > 0 && (
        <table>
          <thead><tr><th>Row</th><th>Problem</th></tr></thead>
          <tbody>
            {rowErrors.map(([row, msg]) => (
              <tr key={row}><td>{row.replace(/^row /, '')}</td><td>{msg}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
