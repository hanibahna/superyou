import { NextResponse, type NextRequest } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { findDupes } from "@/lib/neo-dupes";

export const maxDuration = 300;

// GET = preview (?list=1 for every pair), GET ?apply=1 = hide. Logic in lib/neo-dupes.ts.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const apply = req.nextUrl.searchParams.has("apply");
  const list = req.nextUrl.searchParams.has("list");
  const { candidates, hide, rows, keptBecauseOtherNotLive, pairs, vs, restored } = await findDupes(apply);
  const NEO = "neovitale.com";
  return NextResponse.json({
    applied: apply,
    neovitaleActive: candidates.filter((p) => p.source === NEO).length,
    toHide: hide.size,
    restored: restored.length,
    restoredSample: restored.slice(0, list ? 500 : 30),
    byBarcode: pairs.filter((x) => x.how === "barcode").length,
    byNameAndSize: pairs.filter((x) => x.how !== "barcode").length,
    cheaperCopyIs: { neovitale: pairs.filter((x) => vs(x.other.source) === "neovitale").length, otherSource: pairs.filter((x) => vs(x.other.source) !== "neovitale").length },
    keptBecauseCheaperCopySoldOut: keptBecauseOtherNotLive.length,
    sample: list ? rows : rows.slice(0, 25),
    keptSample: keptBecauseOtherNotLive.slice(0, list ? 500 : 10),
  });
}
