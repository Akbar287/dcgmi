export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function tryQuery<T>(run: () => Promise<T>): Promise<QueryResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[db] query failed:", message);
    return { ok: false, error: message };
  }
}
