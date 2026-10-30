/**
 * Canonical list of ticket categories.
 *
 * Gap G-01 resolution (spec §10):
 * This set is derived from the Bitext Customer Support dataset label structure
 * (simplified to 10 top-level categories). It must stay in sync with the
 * label set produced by the ML training script in services/ml-api/training/.
 *
 * How to update:
 *   1. Retrain the model with the new label set.
 *   2. Update this array to match the new model's classes_.
 *   3. Run a new migration if confirmed_category is constrained at the DB level.
 *      (Current design: free-form VARCHAR — no migration needed.)
 */
export const VALID_CATEGORIES = [
  'account',
  'billing',
  'cancellation',
  'delivery',
  'feedback',
  'order',
  'refund',
  'shipping',
  'technical',
  'other',
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];

/** Returns true if the value is a known category. */
export function isValidCategory(value: string): value is Category {
  return (VALID_CATEGORIES as readonly string[]).includes(value);
}
