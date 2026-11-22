import { SmsEditor } from "@/components/admin/SmsEditor";
import { maskedSms, smsLog } from "@/lib/sms";

export default async function SmsPage() {
  const [cfg, log] = await Promise.all([maskedSms(), smsLog(30)]);
  return <SmsEditor initial={cfg} log={log} />;
}
