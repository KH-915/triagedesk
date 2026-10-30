import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  createTicketSchema,
  updateTicketSchema,
  listTicketsQuerySchema,
} from '../validators/ticket.validator';
import {
  createTicket,
  listTickets,
  getTicketById,
  updateTicket,
} from '../services/ticket.service';
import { JwtPayload } from '../types';
import { AppError } from '../middleware/errorHandler';

/** Converts a ZodError into the field-level map used by the error response shape. */
function zodToFields(err: ZodError): Record<string, string> {
  return err.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'input';
    acc[key] = issue.message;
    return acc;
  }, {});
}

/** Extracts the typed user from the request (set by authenticate middleware). */
function getUser(req: Request): JwtPayload {
  return (req as Request & { user: JwtPayload }).user;
}

// ─── Handlers ─────────────────────────────────────────────────

export async function createTicketHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input.', zodToFields(parsed.error));
    }
    const ticket = await createTicket(parsed.data, getUser(req));
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function listTicketsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listTicketsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Invalid query parameters.',
        zodToFields(parsed.error),
      );
    }
    const result = await listTickets(parsed.data, getUser(req));
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTicketHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ticket = await getTicketById(req.params.id as string, getUser(req));
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function updateTicketHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input.', zodToFields(parsed.error));
    }
    const ticket = await updateTicket(req.params.id as string, parsed.data, getUser(req));
    res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
}
