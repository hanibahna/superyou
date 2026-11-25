// NeoVitale's discount to SuperYou per brand (photo of the supplier's price list, 25 Nov 2026).
// Our cost = NeoVitale's retail price × (1 − discount). "1+1" lines are buy-one-get-one offers,
// not a trade discount: they set no cost. Rows that name a product line (e.g. "L'OREAL EXCELLENCE
// COLOR") apply to products of that brand whose name contains the extra words.
export const NEOVITALE_DISCOUNTS: [string, number | null][] = [
  ["ACCURACY", 20], ["ACM", 25], ["ACNOMIX", 30], ["ADERMA", 35], ["AFRODITA", 25], ["AKILEINE", 25], ["ALPHA", 25],
  ["ANTI-AGING FACIAL MASSAGE", 30], ["ANUA", 20], ["ANDREA LASHES", 10], ["APIVITA", 30], ["AQUAX DEO", 25], ["AUSTRALIAN GOLD", 30],
  ["AVENE", 35], ["AVENT", 20], ["AXIS-Y", 20], ["BABARIA", 20], ["BACHRATI", 25], ["BACTIDOL", 20], ["BATISTE", 25], ["BANANA BOAT", 10],
  ["BEAUTY MASSAGER", 30], ["BEAUTY OF JOSEON", 20], ["BEESLINE", 30], ["BLACKHEAD", 30], ["BIO OIL", 25], ["BIO SECURE", 25], ["BIOCLIN", 25],
  ["BIODERMA", 25], ["BIOLANE", 30], ["BOREADE", 25], ["BOURJOIS", 20], ["CAUDALIE", 25], ["CERAVE", 35], ["CETAPHIL", 25], ["CICA BEAFINE", 30],
  ["CIDAL", 10], ["CMD", 25], ["CHICCO", 25], ["CHRONODERM", 15], ["CLEARASIL", 22.5], ["COLLAGEN NR WITH PROBIOTIC", 22.5], ["COLOR & SOINS", 25],
  ["COSRX", 25], ["COSMALINE", 25], ["COTTON BUDS", 35], ["COUP D'ECLAT", 25], ["D&DERM", 25], ["DARPHIN", 30], ["DBH", 15], ["DCL", 25],
  ["DERMA BOOST", 5], ["DERMA LIGHTENING CREAM", 25], ["DERMACARE", 20], ["DERMACEUTIC", 20], ["DERMAGOR", 25], ["DERMALIA", 35], ["DERMAROLLER", 30],
  ["DERMEDEN", 30], ["DEXERYL", 30], ["DR ORGANIC", 25], ["DEPILAC", 20], ["DUCRAY", 35], ["DURI", 25], ["ECRINAL", 25], ["ELEMENTRE", 40],
  ["EMERALD BAY", 30], ["EPF", 15], ["ESTHERDERM", 30], ["ESSENCE", 20], ["ESSIE", 25], ["ETIAXIL", 30], ["EUBOS", 25], ["EUCERIN", 30],
  ["EVERYDAY", 30], ["EYE CARE", 35], ["FACE FACTS", 25], ["FEMINIC", 30], ["FEMINIC WIPES", 25], ["FILORGA", 35], ["FLAVO", 25], ["FLEXITOL", 20],
  ["FREZYDERM", 35], ["FURTERER", 35], ["RENE FURTERER", 35], ["GAMARDE", 30], ["GARNIER", 9], ["GEHWOL", 30], ["GENOVE", 20], ["HALIBUT", 25],
  ["HELENVITA", 20], ["HELIXIENCE", 25], ["HELIABRINE", 25], ["HELIOCARE", 20], ["HERBATINT", 25], ["HEROME", 15], ["HORMETA", 30],
  ["HYDRA SAB", 25], ["HYDRAX", 25], ["HYDRINITY", 25], ["HYFAC", 25], ["INVENTIA", 25], ["ISDIN", 30], ["ISIS", 30], ["ISIS PHARMA", 30],
  ["JONZAC", 30], ["K THERAPY", 40], ["KERASTASE", 20], ["KETOPAN", 25], ["KHAN AL SABOUN", 20], ["KLORANE", 30], ["LA ROCHE POSAY", 35],
  ["LAKME", 30], ["LAMOR GRAY", 30], ["LANCASTER", 25], ["LANEIGE", 20], ["LAZARTIGUE", 35], ["LEXY", 20], ["LIERAC", 25], ["LOCHERBER", 25],
  ["L'OREAL PROFESSIONNEL", 20], ["L'OREAL PROFESSIONAL", 20], ["L'OREAL EXCELLENCE", 5], ["L'OREAL", 20], ["L'OREAL PARIS", 20],
  ["L'OREAL PARIS EXCELLENCE", 5], ["L'OREAL RETOUCH", 10], ["L'OREAL PARIS RETOUCH", 10], ["MAD", 25], ["MALVA", 25], ["MARTIDERM", 30],
  ["MAVALA", 20], ["MAYBELLINE", 25], ["MAYBELLINE NEW YORK", 25], ["MAX FACTOR", 20], ["MAXI", 20], ["MDL", 22.5], ["MENALIND", 22.5],
  ["MILTON", 10], ["MISSHA", null], ["MIXA", 15], ["MUSTELA", 30], ["MYCODEX", 25], ["NARTA", 10], ["NATESSANCE", 25], ["NEUTROGENA", 40],
  ["NOBACTER", 20], ["NOREVA", 30], ["NOVASKIN", 20], ["NOVIDERM", 25], ["NUK", 25], ["NUTRIPO", 35], ["NUTRITOPIC", 40], ["NUXE", 25],
  ["OBAGI", 10], ["OILS OF NATURE", 25], ["OLAPLEX", 25], ["OILATUM", 35], ["ONAGRINE", 30], ["OPTIMAL", 20], ["PALMERS", 22.5], ["PAPULEX", 22.5],
  ["PAYOT", 30], ["PCA", 17], ["PCA SKIN", 17], ["PERSPIREX", 30], ["PF", 15], ["PIMPLE PATCH", 30], ["PHARMACERIS", 22.5], ["PHARMACLINIC", 25],
  ["PHYTO", 30], ["PRIMAVEA", 25], ["PSORILYS", 25], ["PURAGANCE", 20], ["PURESSENTIEL", 25], ["QUASIX", 15], ["REMEDY", 25], ["REMESCAR", 30],
  ["RESULTIME", 25], ["RETINOL BY ROBANDA", 20], ["ROBANDA", 20], ["REVITALASH", 15], ["REVOX", 35], ["REXOL", 25], ["REXOL FADE", 20],
  ["RIMMEL", 20], ["RIMMEL LONDON", 20], ["ROGER & GALLET", 25], ["ROGE CAVAILLES", 30], ["ROGER CAVAILLES", 30], ["SADOER", null],
  ["SAFORELLE", 25], ["SAMOA", 15], ["SCALPIUM", 25], ["SEBAMED", 25], ["SECHE VITE", 25], ["SENSILAB", 25], ["SESDERMA", 30], ["SESHA", 20],
  ["SHANTEL", 20], ["SHISEIDO", 20], ["SINGULADERM", 25], ["SKIN CARE", 35], ["SKINCEUTICALS", 30], ["SKINIFY", 30], ["SKINHANCE", 25],
  ["SKINLAB", 25], ["SODERMIX", 20], ["SOL DE JANEIRO", 20], ["SOLEIL DES ILES", 20], ["SOME BY MI", 30], ["SORGEL", 25], ["SOSKIN", 20],
  ["SUNSET ECRAN", 20], ["SUNSTOP", 25], ["SVR", 25], ["TALIKA", 25], ["TAN TOUCH", 15], ["TEGODER", 30], ["THE COSMETIC REPUBLIC", 20],
  ["THE ORDINARY", 25], ["TOMMEE TIPPEE", null], ["TOPICREM", 25], ["TRANACIX", 25], ["TRIO AC", 20], ["UGLY LOVELY", 20], ["URAX", 22],
  ["URIAGE", 30], ["VAGIDERM", 25], ["VENIECE", 20], ["VICHY", 35], ["VITA AGE", 30], ["VITAL DERM", 8], ["VIVICEL", 20], ["VIVIER", 25],
  ["XERMATIS", 25], ["XEROLYS", 25], ["XELLENCE", 25], ["ZARTAUX", 25], ["ZOMBIE BEAUTY", 20], ["ZWITSAL", 25], ["ASCE", 25], ["NOVEXPERT", 20],
  ["CELIMAX", 22.5],
];

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9&]+/g, " ").trim();

/** The discount for one product: a row naming its brand, or brand + words found in its name (the most specific wins). */
export function discountFor(brand: string, name: string): number | null | undefined {
  const b = norm(brand), n = ` ${norm(name)} `;
  let best: { len: number; pct: number | null } | undefined;
  for (const [key, pct] of NEOVITALE_DISCOUNTS) {
    const k = norm(key);
    let ok = false;
    if (k === b) ok = true;
    else if (k.startsWith(`${b} `)) ok = n.includes(` ${k.slice(b.length + 1)} `);
    else if (b.startsWith(`${k} `) || b === k.replace(/ /g, "")) ok = true; // "RENE FURTERER PARIS" → "RENE FURTERER"
    if (ok && (!best || k.length > best.len)) best = { len: k.length, pct };
  }
  return best?.pct;
}
