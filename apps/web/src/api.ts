// Thin typed client for the Node API. Errors use the API's shape:
// { error: { code, message, fields? } }

export type Role = 'REQUESTER' | 'AGENT';
export type Status = 'open' | 'in_progress' | 'pending_info' | 'resolved' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export const STATUSES: Status[] = ['open', 'in_progress', 'pending_info', 'resolved', 'closed'];
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];
export const CATEGORIES = [
  'account', 'billing', 'cancellation', 'delivery', 'feedback',
  'order', 'refund', 'shipping', 'technical', 'other',
];

// Mirrors services/api/src/constants/transitions.ts (the server remains the authority).
export const TRANSITIONS: Record<Status, Status[]> = {
  open: ['in_progress', 'closed'],
  in_progress: ['pending_info', 'resolved', 'closed'],
  pending_info: ['in_progress', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export interface User { id: string; email: string; role: Role }

export interface TicketSummary {
  id: string;
  title: string;
  status: Status;
  priority: Priority | null;
  predictedCategory: string | null;
  confirmedCategory: string | null;
  mlStatus: 'pending' | 'success' | 'failed';
  createdAt: string;
}

export interface Ticket extends TicketSummary {
  body: string;
  confidenceScore: number | null;
  modelVersion: string | null;
  confirmedAt: string | null;
}

export interface Page<T> { data: T[]; total: number; page: number; limit: number }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

const TOKEN_KEY = 'triagedesk.token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

export interface ImportResult { imported: number; mlStatus: 'success' | 'failed' }

// FormData bodies are sent as-is so the browser sets the multipart boundary itself.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const isJson = body !== undefined && !(body instanceof FormData);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(isJson ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: isJson ? JSON.stringify(body) : (body as FormData | undefined),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Is the API running?');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Request failed (${res.status})`, e?.fields);
  }
  return json as T;
}

export const api = {
  register: (email: string, password: string) => request('POST', '/auth/register', { email, password }),
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('POST', '/auth/login', { email, password }),
  me: () => request<User>('GET', '/auth/me'),
  listTickets: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && qs.set(k, String(v)));
    return request<Page<TicketSummary>>('GET', `/tickets?${qs}`);
  },
  getTicket: (id: string) => request<Ticket>('GET', `/tickets/${id}`),
  createTicket: (title: string, body: string) => request<Ticket>('POST', '/tickets', { title, body }),
  updateTicket: (id: string, patch: { status?: Status; priority?: Priority; confirmed_category?: string }) =>
    request<Ticket>('PATCH', `/tickets/${id}`, patch),
  importTickets: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<ImportResult>('POST', '/tickets/import', form);
  },
};
