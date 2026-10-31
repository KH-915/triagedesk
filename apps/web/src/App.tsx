import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import TicketListPage from './pages/TicketListPage';
import NewTicketPage from './pages/NewTicketPage';
import TicketDetailPage from './pages/TicketDetailPage';
import ImportTicketsPage from './pages/ImportTicketsPage';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="muted center">Loading…</p>;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const { user, logout } = useAuth();
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">TriageDesk</Link>
        {user && (
          <nav>
            <Link to="/tickets/new">New ticket</Link>
            {user.role === 'AGENT' && <Link to="/tickets/import">Import</Link>}
            <span className="muted">{user.email} · {user.role}</span>
            <button className="link" onClick={logout}>Log out</button>
          </nav>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
          <Route path="/" element={<Protected><TicketListPage /></Protected>} />
          <Route path="/tickets/new" element={<Protected><NewTicketPage /></Protected>} />
          <Route path="/tickets/import" element={<Protected><ImportTicketsPage /></Protected>} />
          <Route path="/tickets/:id" element={<Protected><TicketDetailPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}
