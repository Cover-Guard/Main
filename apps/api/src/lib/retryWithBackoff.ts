export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 300
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
                  return await fn();
                } catch (err: any) {
                  lastError = err;
                  if (attempt < maxRetries - 1) {
                            await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
                          }
                }
        }
    throw lastError;
  }
