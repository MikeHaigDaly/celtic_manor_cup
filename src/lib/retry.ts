/**
 * Retries `fn` once after a short delay if it throws. Serverless functions
 * occasionally hit a transient network blip talking to Supabase (DNS lookup
 * failure, connection reset) — without this, that one flaky connection
 * crashes the whole page render instead of just being retried.
 */
export async function withRetry<T>(fn: () => PromiseLike<T>, delayMs = 250): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}
