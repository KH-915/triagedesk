import { TicketStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { isValidTransition, allowedTransitionsFrom } from '../constants/transitions';
import { isValidCategory } from '../constants/categories';
import { predictCategory } from './ml.service';
import {
  CreateTicketInput,
  UpdateTicketInput,
  ListTicketsQuery,
} from '../validators/ticket.validator';
import { JwtPayload } from '../types';

// ─── Create ───────────────────────────────────────────────────

/**
 * Spec §7.1 — Ticket creation flow:
 *   1. INSERT ticket (ml_status='pending') — committed immediately.
 *   2. Call ML service (may fail; failure does not abort ticket creation).
 *   3. UPDATE ticket with prediction result or ml_status='failed'.
 *   4. Return the final ticket state.
 *
 * The ticket always exists in the DB after step 1, regardless of ML outcome.
 */
export async function createTicket(input: CreateTicketInput, user: JwtPayload) {
  // Step 1: persist the ticket before touching the ML service
  const ticket = await prisma.ticket.create({
    data: {
      userId: user.sub,
      title: input.title,
      body: input.body,
    },
  });

  // Step 2: call ML service; null means any kind of failure
  const mlText = `${input.title} ${input.body}`;
  const prediction = await predictCategory(mlText);

  // Step 3: update ticket with result
  if (prediction) {
    // OD-05: if the label is not in our canonical list, store it as-is and log
    if (!isValidCategory(prediction.predicted_category)) {
      console.warn('[ML] Received unexpected category label', {
        ticket_id: ticket.id,
        label: prediction.predicted_category,
      });
    }

    return prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        predictedCategory: prediction.predicted_category,
        confidenceScore: prediction.confidence_score,
        mlStatus: 'success',
        modelVersion: prediction.model_version,
      },
    });
  }

  return prisma.ticket.update({
    where: { id: ticket.id },
    data: { mlStatus: 'failed' },
  });
}

// ─── List ─────────────────────────────────────────────────────

/**
 * Paginates tickets with optional filters and keyword search.
 * Spec §3 permission rule: REQUESTERs see only their own tickets.
 */
export async function listTickets(query: ListTicketsQuery, user: JwtPayload) {
  const { page, limit, status, priority, confirmed_category, q } = query;

  // Build WHERE clause
  const where: Record<string, unknown> = {};
  if (user.role === Role.REQUESTER) where.userId = user.sub;
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (confirmed_category) where.confirmedCategory = confirmed_category;
  if (q?.trim()) {
    where.OR = [
      { title: { contains: q.trim(), mode: 'insensitive' } },
      { body: { contains: q.trim(), mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.ticket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      // List view omits body to keep responses compact
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        predictedCategory: true,
        confirmedCategory: true,
        mlStatus: true,
        createdAt: true,
      },
    }),
    prisma.ticket.count({ where }),
  ]);

  return { data, total, page, limit };
}

// ─── Get by ID ────────────────────────────────────────────────

/**
 * Spec §6.3 + OD-06:
 * - If ticket not found → 404.
 * - If ticket found but belongs to another user and caller is REQUESTER → 403.
 *   (403 rather than 404: UUIDs are not guessable, so returning 403 is acceptable
 *   and more honest REST semantics.)
 */
export async function getTicketById(id: string, user: JwtPayload) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  }

  if (user.role === Role.REQUESTER && ticket.userId !== user.sub) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this ticket.');
  }

  return ticket;
}

// ─── Update ───────────────────────────────────────────────────

/**
 * Updates agent-writable fields: confirmed_category, priority, status.
 *
 * Enforcements (all server-side, per spec §3):
 *   - Any of the three fields requires the AGENT role.
 *   - Status changes must be a valid transition from the current state.
 *   - predicted_category and confidence_score are NEVER touched here.
 */
export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  user: JwtPayload,
) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });

  if (!ticket) {
    throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
  }

  // All fields in the update schema are agent-only
  const hasAgentField =
    input.confirmed_category !== undefined ||
    input.priority !== undefined ||
    input.status !== undefined;

  if (hasAgentField && user.role !== Role.AGENT) {
    throw new AppError(
      403,
      'FORBIDDEN',
      'Updating confirmed_category, priority, or status requires the AGENT role.',
    );
  }

  // Validate status transition before writing
  if (input.status) {
    const current = ticket.status as TicketStatus;
    const next = input.status as TicketStatus;
    if (!isValidTransition(current, next)) {
      throw new AppError(
        422,
        'INVALID_TRANSITION',
        `Cannot transition from '${current}' to '${next}'. Allowed next statuses: ${allowedTransitionsFrom(current)}.`,
      );
    }
  }

  // Build the update payload
  const data: Record<string, unknown> = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.confirmed_category !== undefined) {
    // OD-04: always overwrite confirmed_by/confirmed_at with the latest agent action
    data.confirmedCategory = input.confirmed_category;
    data.confirmedBy = user.sub;
    data.confirmedAt = new Date();
  }

  return prisma.ticket.update({ where: { id }, data });
}
