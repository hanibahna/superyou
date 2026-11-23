import { CLINIC, PROCEDURES, publicProcedure } from "@/lib/clinic";
import { ClinicView } from "./ClinicView";

export const metadata = { title: "Clinic treatments", description: "Dermatologist treatments with our partner clinic: peels, lasers, microneedling, injectables and more. Book on SuperYou, date confirmed on WhatsApp." };

export default function ClinicPage() {
  return <ClinicView partner={CLINIC.partner} mock={CLINIC.mock} note={CLINIC.note} items={PROCEDURES.map(publicProcedure)} />;
}
