import type { NextRequest } from "next/server";
import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";
import { statsQuery } from "@/lib/stats";

/** Forwards the platform campaigns CSV with the cookie token (the browser cannot send it). */
export async function GET(request: NextRequest) {
  const token = await requireSessionToken();
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const res = await apiFetch(`/admin/stats/campaigns.csv?${statsQuery(params)}`, { token });
  if (!res.ok || !res.body) {
    return Response.json({ statusCode: res.status }, { status: res.status === 403 ? 403 : 502 });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="wathiq-campaigns.csv"',
      "Cache-Control": "no-store",
    },
  });
}
