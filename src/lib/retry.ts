/**
 * Retries `fn` once (with a short delay) if it throws. Deliberately light —
 * Vercel's Hobby plan has a hard 10s function timeout, and this function
 * often runs several of these in one request (see buildScoringContext,
 * resolveSetupIds), so a heavier retry policy (more attempts, longer
 * backoff) risks pushing total execution time past that limit and turning
 * a single slow query into a guaranteed timeout instead of a quick recovery.
 */
export async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 1, delayMs = 100): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (i < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
    }
  }
  throw lastError;
}
