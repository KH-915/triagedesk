import ExcelJS from 'exceljs';
import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { api, clearDatabase, registerAndLogin, disconnectDb } from './helpers';

// ─── Test suite setup ─────────────────────────────────────────

let requesterToken: string;
let agentToken: string;
let agentId: string;

beforeEach(async () => {
  await clearDatabase();
  ({ token: requesterToken } = await registerAndLogin(
    'requester@example.com',
    'password123',
    Role.REQUESTER,
  ));
  ({ token: agentToken, userId: agentId } = await registerAndLogin(
    'agent@example.com',
    'password123',
    Role.AGENT,
  ));
});

afterAll(async () => {
  await clearDatabase();
  await disconnectDb();
});

function upload(token: string, content: string | Buffer, filename: string) {
  return api
    .post('/api/tickets/import')
    .set('Authorization', `Bearer ${token}`)
    .attach('file', Buffer.isBuffer(content) ? content : Buffer.from(content), filename);
}

async function xlsx(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Tickets').addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ─── POST /api/tickets/import ─────────────────────────────────

describe('POST /api/tickets/import', () => {
  it('imports every row of a CSV as tickets owned by the agent', async () => {
    const csv =
      'Title,Body,Priority\n' +
      'Cannot log in,"Password reset email never arrives,\nso I am stuck",High\n' +
      'Charged twice,I see two charges on my card,\n';
    const res = await upload(agentToken, csv, 'tickets.csv');

    expect(res.status).toBe(201);
    // ML service is not running in tests, so the batch prediction fails
    expect(res.body).toEqual({ imported: 2, mlStatus: 'failed' });

    const tickets = await prisma.ticket.findMany({ orderBy: { title: 'asc' } });
    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({
      title: 'Cannot log in',
      body: 'Password reset email never arrives,\nso I am stuck',
      priority: 'high',
      status: 'open',
      userId: agentId,
      mlStatus: 'failed',
      predictedCategory: null,
    });
    expect(tickets[1].priority).toBeNull();
  });

  it('imports an .xlsx file and accepts "description" in place of "body"', async () => {
    const file = await xlsx([
      ['title', 'description'],
      ['Package lost', 'My order never arrived'],
      [],
      ['Refund please', 'I want my money back'],
    ]);
    const res = await upload(agentToken, file, 'tickets.xlsx');

    expect(res.status).toBe(201);
    expect(res.body.imported).toBe(2);
    expect(await prisma.ticket.count()).toBe(2);
  });

  it('returns 422 with per-row errors and imports nothing when any row is invalid', async () => {
    const csv =
      'title,body,priority\n' +
      'Fine,This row is valid,low\n' +
      ',Missing title,\n' +
      'Bad priority,Body here,urgent\n';
    const res = await upload(agentToken, csv, 'tickets.csv');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(res.body.error.fields)).toEqual(['row 3', 'row 4']);
    expect(res.body.error.fields['row 3']).toMatch(/Title/);
    expect(res.body.error.fields['row 4']).toMatch(/priority/);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('returns 400 when required columns are missing', async () => {
    const res = await upload(agentToken, 'subject,text\nHi,there\n', 'tickets.csv');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MISSING_COLUMNS');
  });

  it('returns 400 for a header-only file', async () => {
    const res = await upload(agentToken, 'title,body\n', 'tickets.csv');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('EMPTY_FILE');
  });

  it('returns 400 for an unsupported file type', async () => {
    const res = await upload(agentToken, 'title,body\nA,B\n', 'tickets.txt');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNSUPPORTED_FILE');
  });

  it('returns 400 for a corrupt .xlsx file', async () => {
    const res = await upload(agentToken, 'not a zip', 'tickets.xlsx');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE');
  });

  it('returns 400 when more than 1000 rows are uploaded', async () => {
    const csv = 'title,body\n' + 'T,B\n'.repeat(1001);
    const res = await upload(agentToken, csv, 'tickets.csv');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TOO_MANY_ROWS');
  });

  it('returns 400 when no file is attached', async () => {
    const res = await api.post('/api/tickets/import').set('Authorization', `Bearer ${agentToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 403 for a REQUESTER', async () => {
    const res = await upload(requesterToken, 'title,body\nA,B\n', 'tickets.csv');
    expect(res.status).toBe(403);
    expect(await prisma.ticket.count()).toBe(0);
  });

  it('returns 401 without a token', async () => {
    const res = await api
      .post('/api/tickets/import')
      .attach('file', Buffer.from('title,body\nA,B\n'), 'tickets.csv');
    expect(res.status).toBe(401);
  });
});
