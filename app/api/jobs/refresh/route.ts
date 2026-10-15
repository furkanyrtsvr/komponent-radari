import { config, list, HttpError } from "@/lib/server/db";
import { syncLive } from "@/lib/server/live";
import { ensureSeed } from "@/lib/server/seed";
import type { Offer } from "@/lib/domain";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const expected = config("CRON_SECRET");
  if (
    !expected ||
    request.headers.get("authorization") !== `Bearer ${expected}`
  )
    return Response.json({ error: "Yetkisiz görev isteği" }, { status: 401 });
  await ensureSeed();
  const stale = (await list<Offer>("store_offers", { source: "live" }))
    .filter(
      (o) =>
        Date.now() - new Date(o.last_checked_at).getTime() > 20 * 60 * 1000,
    )
    .slice(0, 20);
  try {
    return Response.json(
      await syncLive([...new Set(stale.map((o) => o.canonical_product_id))]),
    );
  } catch (e) {
    console.error("Refresh job failed", e);
    return Response.json(
      { error: "Görev başarısız." },
      { status: e instanceof HttpError ? e.status : 500 },
    );
  }
}
