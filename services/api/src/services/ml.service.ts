import axios, { AxiosError } from 'axios';
import { config } from '../config';

// ─── Types ────────────────────────────────────────────────────

export interface MlPrediction {
  predicted_category: string;
  confidence_score: number;
  model_version: string;
}

// ─── Prediction ───────────────────────────────────────────────

/**
 * Calls the FastAPI /predict endpoint.
 *
 * Spec §7.4 — this function NEVER throws.
 * On timeout, network error, or non-2xx response it returns null.
 * The caller (ticket.service) is responsible for setting ml_status accordingly.
 *
 * OD-05b: text is truncated to 5000 chars before being sent, matching the
 * same truncation applied during model training.
 */
export async function predictCategory(text: string): Promise<MlPrediction | null> {
  const truncated = text.slice(0, 5000);

  try {
    const response = await axios.post<MlPrediction>(
      `${config.ML_SERVICE_URL}/predict`,
      { text: truncated },
      { timeout: config.ML_TIMEOUT_MS },
    );
    return response.data;
  } catch (err) {
    const error = err as AxiosError;

    if (error.code === 'ECONNABORTED') {
      console.warn('[ML] predictCategory timed out', { timeout_ms: config.ML_TIMEOUT_MS });
    } else if (error.response) {
      console.warn('[ML] predictCategory received error response', {
        status: error.response.status,
      });
    } else {
      console.warn('[ML] predictCategory network error', {
        code: error.code,
        message: error.message,
      });
    }

    return null;
  }
}

const BATCH_TIMEOUT_MS = 15_000;

/**
 * Batch variant used by bulk import: one call to /predict/batch for all texts.
 * Same contract as predictCategory — never throws; null means the whole batch failed.
 * The timeout is longer than a single prediction's since it covers up to 1000 texts.
 */
export async function predictCategories(texts: string[]): Promise<MlPrediction[] | null> {
  try {
    const response = await axios.post<{ predictions: MlPrediction[] }>(
      `${config.ML_SERVICE_URL}/predict/batch`,
      { texts: texts.map((t) => t.slice(0, 5000)) },
      { timeout: Math.max(config.ML_TIMEOUT_MS, BATCH_TIMEOUT_MS) },
    );
    if (response.data.predictions?.length !== texts.length) {
      console.warn('[ML] predictCategories returned a mismatched batch', {
        expected: texts.length,
        received: response.data.predictions?.length,
      });
      return null;
    }
    return response.data.predictions;
  } catch (err) {
    const error = err as AxiosError;
    console.warn('[ML] predictCategories failed', {
      code: error.code,
      status: error.response?.status,
      message: error.message,
    });
    return null;
  }
}

// ─── Health check ─────────────────────────────────────────────

/** Used by the /api/health endpoint to report ML service reachability. */
export async function checkMlHealth(): Promise<boolean> {
  try {
    await axios.get(`${config.ML_SERVICE_URL}/health`, { timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}
