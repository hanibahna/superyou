import "server-only";

import { defaultOps, withOpsDefaults, type Ops } from "@/lib/ops";
import { readDoc, writeDoc } from "@/lib/site-store";

export const getOps = () => readDoc<Ops>("ops", defaultOps, (v) => withOpsDefaults(v));
export const saveOps = (v: Ops) => writeDoc("ops", v);
