// Subscribe & save is for things that run out (creams, vitamins, refills, wipes…), not for tools,
// devices or accessories bought once. Client-safe.
const HARDWARE = /\b(brush|brushes|sponge|blender|tweezer|tweezers|mirror|scissors?|clipper|cutter|curler|curling|straightener|flat ?iron|dryer|diffuser|trimmer|shaver|epilator|device|machine|massager|roller|gua ?sha|comb|bag|pouch|case|organi[sz]er|holder|sharpener|thermometer|scale|nebuli[sz]er|tension|monitor|toothbrush(?! head)|electric|led|lamp|kit bag|mannequin|applicator|dispenser|bottle|storage|headband|towel|gift ?box|tool|tools|set of brushes)\b/i;
const DISPOSABLE = /\b(blade|blades|refill|refills|pads?|wipes?|cotton|sheet ?mask|tissues?|strips?|cartridges?|heads?|replacement|disposable|lancets?|test ?strips?|nappies|diapers?|liners?|pantyliners?|tampons?|plasters?|bandages?)\b/i;

export function isSubscribable(p: { name: string; category?: string }): boolean {
  const n = p.name;
  if (DISPOSABLE.test(n)) return true;
  if (p.category && /tool|accessor|device|appliance/i.test(p.category)) return false;
  return !HARDWARE.test(n);
}
