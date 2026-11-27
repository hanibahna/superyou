// Only claims the shop can stand behind reach customers. Wording saved earlier in the admin
// ("official distributors", "licensed Lebanese pharmacy") is corrected wherever it is shown.
const RULES: [RegExp, string][] = [
  [/sourced from official (lebanese )?distributors/gi, "Sealed, genuine brand products"],
  [/from official (lebanese )?distributors( in lebanon)?/gi, "sealed and genuine"],
  [/official (lebanese )?distributors/gi, "sealed, genuine brand products"],
  [/(supplied by|from) a licensed lebanese pharmacy/gi, "sealed, genuine brand products"],
];
export const honest = (s: string) => RULES.reduce((t, [re, to]) => t.replace(re, to), s ?? "");
