import { FormEvent, useState } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await (mode === 'login' ? login : register)(email, password);
    } catch (err) {
      const ae = err as ApiError;
      const fields = ae.fields ? ' ' + Object.values(ae.fields).join('; ') : '';
      setError(ae.message + fields);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
      <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password
        <input type="password" required minLength={mode === 'register' ? 8 : 1} value={password}
          onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Register'}</button>
      <p className="muted">
        {mode === 'login' ? 'No account?' : 'Already registered?'}{' '}
        <button type="button" className="link"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </button>
      </p>
    </form>
  );
}
