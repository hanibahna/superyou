import { AccountView } from "./AccountView";

export const metadata = { title: "My account", robots: { index: false, follow: true } };

export default function AccountPage() {
  return <AccountView />;
}
