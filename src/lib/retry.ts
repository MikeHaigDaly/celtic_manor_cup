/**
 * Retries `fn` (up to `attempts` extra tries) if it throws, with a short
 * backoff between each. Serverless functions occasionally hit a transient
 * network blip talking to Supabase (DNS lookup failure, connection reset,
 * cold-start hiccup) — without this, that one flaky connection crashes the
 * whole page render instead of just being retried.
 */
export async function withRetry<T>(fn: () => PromiseLike<T>, attempts = 2, delayMs = 200): Promise<T> {
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
