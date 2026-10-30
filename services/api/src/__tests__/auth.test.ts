import { Role } from '@prisma/client';
import { api, clearDatabase, createTestUser, registerAndLogin, disconnectDb } from './helpers';

// ─── Test suite setup ─────────────────────────────────────────

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await clearDatabase();
  await disconnectDb();
});

// ─── POST /api/auth/register ──────────────────────────────────

describe('POST /api/auth/register', () => {
  it('returns 201 and a safe user object on valid input', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'securepass123',
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'alice@example.com', role: 'REQUESTER' });
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('createdAt');
    // Password must never appear in any response
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
    expect(res.body).not.toHaveProperty('password');
  });

  it('returns 409 when the email is already registered', async () => {
    await createTestUser('alice@example.com');
    const res = await api.post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'anotherpassword',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_CONFLICT');
  });

  it('returns 400 with a field error when password is too short', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'bob@example.com',
      password: 'short',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toHaveProperty('password');
  });

  it('returns 400 with a field error when email is missing', async () => {
    const res = await api.post('/api/auth/register').send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('email');
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'password123',
    });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('email');
  });

  it('normalizes email to lowercase before storing', async () => {
    const res = await api.post('/api/auth/register').send({
      email: 'ALICE@EXAMPLE.COM',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.email).toBe('alice@example.com');
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await createTestUser('alice@example.com');
  });

  it('returns 200 with a JWT token on correct credentials', async () => {
    const res = await api.post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toMatchObject({ email: 'alice@example.com', role: 'REQUESTER' });
  });

  it('returns 401 on wrong password', async () => {
    const res = await api.post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrongpassword',
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 401 on unknown email (same code as wrong password)', async () => {
    const res = await api.post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'password123',
    });

    // Spec §6.2: must not distinguish between "email not found" and "wrong password"
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 when email is missing', async () => {
    const res = await api.post('/api/auth/login').send({ password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toHaveProperty('email');
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns 200 and user profile with a valid token', async () => {
    const { token } = await registerAndLogin('alice@example.com');
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'alice@example.com', role: 'REQUESTER' });
    expect(res.body).not.toHaveProperty('passwordHash');
  });

  it('returns 401 when no Authorization header is provided', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the token is malformed', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', 'Bearer notavalidjwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when the Authorization header is missing the Bearer prefix', async () => {
    const { token } = await registerAndLogin('alice@example.com');
    const res = await api.get('/api/auth/me').set('Authorization', token);
    expect(res.status).toBe(401);
  });

  it('includes the role for an AGENT user', async () => {
    const { token } = await registerAndLogin('agent@example.com', 'password123', Role.AGENT);
    const res = await api.get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('AGENT');
  });
});
