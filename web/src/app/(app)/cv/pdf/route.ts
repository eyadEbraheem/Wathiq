import { apiFetch } from "@/lib/api";
import { requireSessionToken } from "@/lib/session";

/**
 * The signed-in user's CV as a PDF file. The API makes the file; this only forwards it, because
 * the session token lives in an httpOnly cookie that the browser's JavaScript cannot read.
 */
export async function GET() {
  const token = await requireSessionToken();
  const res = await apiFetch("/users/me/cv/pdf", { token });
  if (!res.ok || !res.body) {
    return Response.json({ statusCode: res.status }, { status: res.status === 403 ? 403 : 502 });
  }
  return new Response(res.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        res.headers.get("Content-Disposition") ?? 'attachment; filename="wathiq-cv.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
