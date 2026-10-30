import { z } from 'zod';
import { TicketStatus, Priority } from '@prisma/client';
import { VALID_CATEGORIES } from '../constants/categories';

// ─── Create ───────────────────────────────────────────────────

export const createTicketSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be 200 characters or fewer'),
  body: z
    .string({ required_error: 'Body is required' })
    .min(1, 'Body cannot be empty')
    .max(5000, 'Body must be 5000 characters or fewer'),
});

// ─── Update ───────────────────────────────────────────────────

const statusValues: [TicketStatus, ...TicketStatus[]] = [
  'open',
  'in_progress',
  'pending_info',
  'resolved',
  'closed',
];

const priorityValues: [Priority, ...Priority[]] = ['low', 'medium', 'high', 'critical'];

// VALID_CATEGORIES is a readonly tuple — cast to mutable tuple for z.enum
const categoryValues = VALID_CATEGORIES as unknown as [string, ...string[]];

export const updateTicketSchema = z
  .object({
    confirmed_category: z
      .enum(categoryValues, {
        errorMap: () => ({
          message: `confirmed_category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        }),
      })
      .optional(),
    priority: z
      .enum(priorityValues, {
        errorMap: () => ({
          message: 'priority must be one of: low, medium, high, critical',
        }),
      })
      .optional(),
    status: z
      .enum(statusValues, {
        errorMap: () => ({
          message:
            'status must be one of: open, in_progress, pending_info, resolved, closed',
        }),
      })
      .optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided (confirmed_category, priority, or status)',
  });

// ─── List / search ────────────────────────────────────────────

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100, 'limit must be 100 or fewer')
    .default(20),
  status: z.enum(statusValues).optional(),
  priority: z.enum(priorityValues).optional(),
  confirmed_category: z.string().optional(),
  q: z.string().optional(),
});

// ─── Inferred types ───────────────────────────────────────────

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;
