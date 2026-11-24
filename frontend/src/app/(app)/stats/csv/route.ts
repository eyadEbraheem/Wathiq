import type { NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import { statsQuery } from "@/lib/stats";

/** Forwards the organizer's own campaigns CSV with the cookie token. */
export async function GET(request: NextRequest) {
  const token = await requireSessionToken();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const res = await apiFetch(`/users/me/stats/campaigns.csv?${statsQuery(params)}`, { token });
  if (!res.ok || !res.body) {
    return Response.json({ statusCode: res.status }, { status: res.status === 403 ? 403 : 502 });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-campaigns.csv"',
      "Cache-Control": "no-store",
    },
  });
}
