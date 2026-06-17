/**
 * Bulk allocate — loops STEX get-num per range with small delay
 * to respect upstream rate limits. Returns per-range result list.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  items: z
    .array(
      z.object({
        rid: z.string().min(2).max(64),
        sid: z.string().trim().max(80).optional().nullable(),
        count: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
});

export const bulkAllocateFn = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { requireAuth } = await import("./auth-guard.server");
    const auth = requireAuth(data.token);
    const { sql } = await import("./db.server");
    const { stexGetNum } = await import("./stex.server");

    type Result = {
      rid: string;
      sid: string | null;
      ok: boolean;
      full_number?: string;
      country?: string;
      error?: string;
    };
    const results: Result[] = [];

    for (const item of data.items) {
      for (let i = 0; i < item.count; i++) {
        try {
          const r = await stexGetNum(item.rid);
          if (r.meta.code === 2946 || !r.data) {
            results.push({ rid: item.rid, sid: item.sid ?? null, ok: false, error: "Out of stock" });
            break; // stop this range
          }
          if (r.meta.code !== 200 || !r.data) {
            results.push({ rid: item.rid, sid: item.sid ?? null, ok: false, error: r.message || "Upstream error" });
            break;
          }
          const n = r.data;
          await sql`
            INSERT INTO allocations (user_id, rid, sid, full_number, national_number, no_plus_number, country, operator, status, stex_response)
            VALUES (${auth.sub}, ${item.rid}, ${item.sid ?? null}, ${n.full_number}, ${n.national_number}, ${n.no_plus_number}, ${n.country}, ${n.operator}, 'pending', ${JSON.stringify(r)}::jsonb)
          `;
          results.push({
            rid: item.rid,
            sid: item.sid ?? null,
            ok: true,
            full_number: n.full_number,
            country: n.country,
          });
          // Small spacing between upstream calls
          await new Promise((res) => setTimeout(res, 250));
        } catch (e: any) {
          results.push({ rid: item.rid, sid: item.sid ?? null, ok: false, error: e?.message || "Failed" });
          break;
        }
      }
    }
    const ok = results.filter((r) => r.ok).length;
    return { ok, total: results.length, results };
  });
