import { Role } from '@prisma/client';
import { api, clearDatabase, registerAndLogin, disconnectDb } from './helpers';

// ─── Test suite setup ─────────────────────────────────────────

let requesterToken: string;
let agentToken: string;

beforeEach(async () => {
  await clearDatabase();
  ({ token: requesterToken } = await registerAndLogin(
    'requester@example.com',
    'password123',
    Role.REQUESTER,
  ));
  ({ token: agentToken } = await registerAndLogin(
    'agent@example.com',
    'password123',
    Role.AGENT,
  ));
});

afterAll(async () => {
  await clearDatabase();
  await disconnectDb();
});

// ─── POST /api/tickets ────────────────────────────────────────

describe('POST /api/tickets', () => {
  it('returns 201 with a valid ticket; ml_status is success or failed', async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'Cannot log in', body: 'I cannot access my account.' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Cannot log in', status: 'open' });
    expect(res.body.priority).toBeNull();
    expect(res.body.confirmedCategory).toBeNull();
    // ML service is not running in tests, so ml_status should be 'failed'
    expect(['success', 'failed']).toContain(res.body.mlStatus);
  });

  it('returns 201 with ml_status=failed when ML service is unavailable', async () => {
    // ML service is not running during unit tests — this is the expected default
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'Billing issue', body: 'I was charged twice.' });

    expect(res.status).toBe(201);
    expect(res.body.mlStatus).toBe('failed');
    expect(res.body.predictedCategory).toBeNull();
  });

  it('predicted_category is preserved and never overwritten', async () => {
    // Create ticket (ml_status=failed in test env)
    const createRes = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'Test', body: 'Test body' });

    const ticketId: string = createRes.body.id;
    const originalPredicted: string | null = createRes.body.predictedCategory;

    // Agent sets confirmed_category
    await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ confirmed_category: 'billing' });

    // Fetch and verify predicted_category is unchanged
    const getRes = await api
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(getRes.body.predictedCategory).toBe(originalPredicted);
  });

  it('returns 400 when title is missing', async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ body: 'Some body text' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('title');
  });

  it('returns 400 when title exceeds 200 characters', async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'A'.repeat(201), body: 'Valid body' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when body exceeds 5000 characters', async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'Valid title', body: 'B'.repeat(5001) });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await api
      .post('/api/tickets')
      .send({ title: 'Test', body: 'Test body' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/tickets ─────────────────────────────────────────

describe('GET /api/tickets', () => {
  beforeEach(async () => {
    // Create one ticket as requester
    await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'Requester ticket', body: 'Some issue' });
  });

  it('agent sees all tickets', async () => {
    const res = await api.get('/api/tickets').set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data).toHaveLength(1);
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 20);
  });

  it('requester sees only their own tickets', async () => {
    // Second requester creates a ticket
    const { token: otherToken } = await registerAndLogin('other@example.com', 'password123');
    await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ title: 'Other ticket', body: 'Other body' });

    const res = await api.get('/api/tickets').set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Requester ticket');
  });

  it('respects the limit parameter', async () => {
    // Create 3 more tickets
    for (let i = 0; i < 3; i++) {
      await api
        .post('/api/tickets')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ title: `Extra ticket ${i}`, body: 'Body' });
    }

    const res = await api
      .get('/api/tickets?limit=2&page=1')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.limit).toBe(2);
  });

  it('returns 400 when limit exceeds 100', async () => {
    const res = await api
      .get('/api/tickets?limit=200')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('filters by status', async () => {
    // Create a second ticket and advance it to in_progress
    const createRes = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ title: 'In-progress ticket', body: 'Body' });

    await api
      .patch(`/api/tickets/${createRes.body.id as string}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'in_progress' });

    const res = await api
      .get('/api/tickets?status=in_progress')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((t: { status: string }) => t.status === 'in_progress')).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await api.get('/api/tickets');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/tickets/:id ─────────────────────────────────────

describe('GET /api/tickets/:id', () => {
  let ticketId: string;

  beforeEach(async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'My ticket', body: 'My issue description' });
    ticketId = res.body.id as string;
  });

  it('requester can view their own ticket with full details', async () => {
    const res = await api
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
    // Full detail includes body and ML fields
    expect(res.body).toHaveProperty('body');
    expect(res.body).toHaveProperty('mlStatus');
  });

  it('agent can view any ticket', async () => {
    const res = await api
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
  });

  it('requester gets 403 for another user\'s ticket (spec OD-06)', async () => {
    const { token: otherToken } = await registerAndLogin('other2@example.com');
    const res = await api
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${otherToken}`);

    // Must be 403, not 404 — spec OD-06 decision
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a non-existent ticket ID', async () => {
    const res = await api
      .get('/api/tickets/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${agentToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── PATCH /api/tickets/:id ───────────────────────────────────

describe('PATCH /api/tickets/:id', () => {
  let ticketId: string;

  beforeEach(async () => {
    const res = await api
      .post('/api/tickets')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ title: 'My ticket', body: 'My issue' });
    ticketId = res.body.id as string;
  });

  it('agent can set confirmed_category without changing predictedCategory', async () => {
    const before = await api
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`);

    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ confirmed_category: 'billing' });

    expect(res.status).toBe(200);
    expect(res.body.confirmedCategory).toBe('billing');
    expect(res.body.confirmedBy).toBeTruthy();
    expect(res.body.confirmedAt).toBeTruthy();
    // Spec requirement: ML prediction fields must be unchanged
    expect(res.body.predictedCategory).toBe(before.body.predictedCategory);
  });

  it('agent can set priority', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high');
  });

  it('agent can perform valid status transition: open → in_progress', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 422 on invalid status transition: closed → open', async () => {
    // Move to closed first
    await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'closed' });

    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'open' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
    // Error message should mention terminal state
    expect(res.body.error.message).toMatch(/closed/);
  });

  it('returns 422 on invalid status transition: open → resolved', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('returns 400 on invalid priority value', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ priority: 'extreme' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 on invalid confirmed_category value', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ confirmed_category: 'invalid-category' });

    expect(res.status).toBe(400);
  });

  it('requester cannot update confirmed_category (403)', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ confirmed_category: 'billing' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('requester cannot update priority (403)', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(403);
  });

  it('requester cannot update status (403)', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(403);
  });

  it('returns 404 when ticket ID does not exist', async () => {
    const res = await api
      .patch('/api/tickets/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ priority: 'high' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when no fields are provided', async () => {
    const res = await api
      .patch(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});
