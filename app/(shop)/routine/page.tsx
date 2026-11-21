import { getLang } from "@/lib/i18n-server";
import { translateDeep, translateMany } from "@/lib/translate";
import { notFound } from "next/navigation";
import { getRoutine } from "@/lib/site-store";
import { RoutineWizard } from "./RoutineWizard";

export async function generateMetadata() {
  return { title: (await getRoutine()).title };
}

export default async function RoutinePage() {
  const cfg0 = await getRoutine();
  if (!cfg0.enabled) notFound();
  const lang = await getLang();
  const cfg = await translateDeep(cfg0, lang, ["title", "intro", "label", "hint"]);
  const labels = await translateMany([...cfg0.concernOptions.map((c) => c.label), ...cfg0.goals.map((g) => g.label)], lang);
  return (
    <RoutineWizard
      title={cfg.title}
      intro={cfg.intro}
      skinTypes={cfg.skinTypes.map(({ id, label, hint }) => ({ id, label, hint }))}
      concerns={cfg0.concernOptions.map((c) => c.label)}
      goals={cfg0.goals.map((g) => g.label)}
      labels={Object.fromEntries(labels)}
    />
  );
}
