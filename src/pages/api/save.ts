import type { APIRoute } from "astro";
import { savePage, verifySession } from "../../utils/octo";
import { checkRateLimit, RateLimitError } from "../../utils/rate-limit";

export const POST: APIRoute = async ({ request }) => {
  let body: { path: string; content: string; sha: string };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { path, content, sha } = body;

  if (!path || content === undefined || !sha) {
    return new Response(
      JSON.stringify({ error: "missing required fields: path, content, sha" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const session = await verifySession(request);
    await checkRateLimit(session.user.id, "/api/save", { max: 10, windowSec: 60 });
    const result = await savePage(session, path, content, sha);
    
    // Return the new sha so the client can track it for the next save
    const newSha = (result.data.content as any)?.sha ?? sha;

    return new Response(JSON.stringify({ ok: true, sha: newSha }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    // 409 = stale sha (conflict)
    if (e?.status === 409 || e?.message?.includes("409")) {
      return new Response(
        JSON.stringify({ error: "conflict: file was modified since last load" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    if (e instanceof RateLimitError) {
        return new Response(
            JSON.stringify({ error: `rate limit exceeded. try again in ${e.retryAfter}s` }),
            { status: 429, headers: { "Content-Type": "application/json" } }
        );
    }

    if (e?.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.error("[/api/save] GitHub error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "internal error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};