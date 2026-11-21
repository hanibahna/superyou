// Tiny Redis client over Upstash's REST API (no SDK needed).
// On Vercel: Storage → Create → Upstash (Redis). The integration adds
// KV_REST_API_URL / KV_REST_API_TOKEN automatically. UPSTASH_REDIS_REST_* also works.
// Without those variables everything is kept in memory (local dev only — not persistent).

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const dbConfigured = Boolean(url && token);

type Cmd = (string | number)[];

async function remote<T>(cmd: Cmd): Promise<T> {
  const res = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(`Database error: ${data.error ?? res.status}`);
  return data.result as T;
}

async function remotePipeline(cmds: Cmd[]): Promise<unknown[]> {
  if (!cmds.length) return [];
  const res = await fetch(`${url!.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store",
  });
  const data = (await res.json()) as { result?: unknown; error?: string }[];
  if (!res.ok) throw new Error(`Database error: ${res.status}`);
  const failed = data.find((d) => d.error);
  if (failed) throw new Error(`Database error: ${failed.error}`);
  return data.map((d) => d.result);
}

// ── In-memory fallback (same semantics, subset of commands) ──
type Mem = { strings: Map<string, string>; hashes: Map<string, Map<string, string>>; zsets: Map<string, Map<string, number>> };
const g = globalThis as unknown as { __mem?: Mem };
const mem: Mem = (g.__mem ??= { strings: new Map(), hashes: new Map(), zsets: new Map() });

function local(cmd: Cmd): unknown {
  const [op, key, ...a] = cmd.map(String);
  const h = () => mem.hashes.get(key) ?? (mem.hashes.set(key, new Map()), mem.hashes.get(key)!);
  const z = () => mem.zsets.get(key) ?? (mem.zsets.set(key, new Map()), mem.zsets.get(key)!);
  switch (op.toUpperCase()) {
    case "GET": return mem.strings.get(key) ?? null;
    case "SET":
      if (a.includes("NX") && mem.strings.has(key)) return null;
      mem.strings.set(key, a[0]); return "OK";
    case "INCR": { const n = Number(mem.strings.get(key) ?? 0) + 1; mem.strings.set(key, String(n)); return n; }
    case "DEL": return [mem.strings.delete(key), mem.hashes.delete(key), mem.zsets.delete(key)].some(Boolean) ? 1 : 0;
    case "HSET": for (let i = 0; i < a.length; i += 2) h().set(a[i], a[i + 1]); return a.length / 2;
    case "HGET": return mem.hashes.get(key)?.get(a[0]) ?? null;
    case "HDEL": return a.filter((f) => mem.hashes.get(key)?.delete(f)).length;
    case "HSCAN": {
      // Simple cursor = offset; COUNT is honoured exactly.
      const h = mem.hashes.get(key) ?? new Map();
      const start = Number(a[0]);
      const ci = a.findIndex((x) => String(x).toUpperCase() === "COUNT");
      const count = ci >= 0 ? Number(a[ci + 1]) : 10;
      const entries = [...h.entries()].slice(start, start + count);
      const next = start + count >= h.size ? "0" : String(start + count);
      return [next, entries.flat()];
    }
    case "HVALS": return [...(mem.hashes.get(key)?.values() ?? [])];
    case "HLEN": return mem.hashes.get(key)?.size ?? 0;
    case "ZADD": z().set(a[1], Number(a[0])); return 1;
    case "ZREVRANGE": {
      const all = [...(mem.zsets.get(key)?.entries() ?? [])].sort((x, y) => y[1] - x[1]).map(([m]) => m);
      const end = Number(a[1]);
      return all.slice(Number(a[0]), end < 0 ? all.length + end + 1 : end + 1);
    }
    case "ZCARD": return mem.zsets.get(key)?.size ?? 0;
    case "ZREM": return a.filter((m) => mem.zsets.get(key)?.delete(m)).length;
    case "ZRANGEBYSCORE": {
      const lo = a[0] === "-inf" ? -Infinity : Number(a[0]), hi = a[1] === "+inf" ? Infinity : Number(a[1]);
      const li = a.findIndex((x) => x.toUpperCase() === "LIMIT");
      const all = [...(mem.zsets.get(key)?.entries() ?? [])].filter(([, s]) => s >= lo && s <= hi).sort((x, y) => x[1] - y[1]).map(([m]) => m);
      return li >= 0 ? all.slice(Number(a[li + 1]), Number(a[li + 1]) + Number(a[li + 2])) : all;
    }
    case "INCRBY": { const n = Number(mem.strings.get(key) ?? 0) + Number(a[0]); mem.strings.set(key, String(n)); return n; }
    case "ZREMRANGEBYRANK": {
      const zs = mem.zsets.get(key); if (!zs) return 0;
      const all = [...zs.entries()].sort((x, y) => x[1] - y[1]).map(([m]) => m);
      const st = Number(a[0]), en = Number(a[1]);
      const del = all.slice(st < 0 ? Math.max(0, all.length + st) : st, en < 0 ? all.length + en + 1 : en + 1);
      del.forEach((m) => zs.delete(m)); return del.length;
    }
    case "HGETALL": return [...(mem.hashes.get(key)?.entries() ?? [])].flat();
    case "HINCRBY": { const n = Number(h().get(a[0]) ?? 0) + Number(a[1]); h().set(a[0], String(n)); return n; }
    default: throw new Error(`Unsupported in memory store: ${op}`);
  }
}

export const db = {
  cmd: <T = unknown>(cmd: Cmd): Promise<T> => (dbConfigured ? remote<T>(cmd) : Promise.resolve(local(cmd) as T)),
  pipeline: (cmds: Cmd[]): Promise<unknown[]> => (dbConfigured ? remotePipeline(cmds) : Promise.resolve(cmds.map(local))),
};
