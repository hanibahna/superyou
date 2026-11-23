import type { Metadata } from "next";

// Private page: a clear title, kept out of search results.
export const metadata: Metadata = { title: "Your subscription", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
