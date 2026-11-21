export const metadata = { title: "Coming soon", robots: { index: false, follow: false } };

export default async function SiteLock({ searchParams }: { searchParams: Promise<{ next?: string; e?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-ink px-6 text-white">
      <div className="w-full max-w-sm text-center">
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-mark.svg" alt="" aria-hidden className="h-11 w-11 rounded-lg ring-1 ring-white/25" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/superyou-logo-white.svg" alt="SuperYou" className="h-7 w-auto" />
        </div>
        <p className="mt-8 text-2xl font-semibold">Opening soon</p>
        <p className="mt-2 text-sm text-white/70">This preview is private. Enter the password to continue.</p>
        <form action="/api/site-lock/" method="post" className="mt-6 space-y-3">
          <input type="hidden" name="next" value={sp.next ?? "/"} />
          <label htmlFor="pw" className="sr-only">Password</label>
          <input id="pw" name="password" type="password" required autoFocus autoComplete="current-password" placeholder="Password" className="w-full rounded-full border border-white/25 bg-white/10 px-5 py-3 text-white outline-none placeholder:text-white/50 focus:border-white" />
          {sp.e && <p className="text-sm text-[#f3a6bf]">{sp.e === "wait" ? "Too many tries. Wait 15 minutes." : "Wrong password."}</p>}
          <button className="w-full rounded-full bg-white py-3 font-semibold text-ink">Enter</button>
        </form>
      </div>
    </main>
  );
}
