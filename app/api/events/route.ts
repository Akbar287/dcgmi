import { can } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { liveCalls, liveStatus, LIVE_REFS, type LiveRef } from "@/lib/db/repository/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const TICK_MS = 1000;
const HEARTBEAT_MS = 15_000;
const LIFETIME_MS = 280_000;

/**
 * Server-Sent Events (SPECIFICATION §4.9 "aliran langsung"): status changes
 * and every model call of a session or run as the ledger records it. The
 * browser reconnects with Last-Event-ID (the last call's timestamp), so a
 * stream closed by the platform's duration limit resumes without gaps.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "console:read")) return new Response("Forbidden", { status: 403 });
  const url = new URL(request.url);
  const [type, id] = (url.searchParams.get("ref") ?? "").split(":");
  if (!LIVE_REFS.includes(type as LiveRef) || !id) return new Response("Bad ref", { status: 400 });
  const lastId = request.headers.get("last-event-id") ?? url.searchParams.get("since");
  let cursor = lastId && !Number.isNaN(Date.parse(lastId)) ? new Date(lastId) : new Date(Date.now() - 60_000);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown, eventId?: string) => controller.enqueue(encoder.encode(`${eventId ? `id: ${eventId}\n` : ""}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const started = Date.now();
      let lastStatus = "";
      let lastBeat = Date.now();
      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      try {
        while (!request.signal.aborted && Date.now() - started < LIFETIME_MS) {
          const status = await liveStatus(type as LiveRef, id);
          if (!status) {
            send("gone", {});
            break;
          }
          const key = JSON.stringify(status);
          if (key !== lastStatus) {
            send("status", status);
            lastStatus = key;
          }
          for (const call of await liveCalls(type as LiveRef, id, cursor)) {
            send("call", call, call.createdAt);
            cursor = new Date(call.createdAt);
          }
          if (status.terminal) {
            send("end", status);
            break;
          }
          if (Date.now() - lastBeat > HEARTBEAT_MS) {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
            lastBeat = Date.now();
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      } catch {
        // The client reconnects with Last-Event-ID.
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
