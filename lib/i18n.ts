// English / Arabic. The English text is the key, so untranslated text simply stays English.
// Product names and brands are not translated. Client-safe.

import { DICT } from "./i18n-dict";

export type Lang = "en" | "fr" | "ar";
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "ar", label: "العربية", short: "ع" },
];
export const isLang = (x: unknown): x is Lang => x === "en" || x === "fr" || x === "ar";

const ar: Record<string, string> = {
  // header, menu, tab bar
  Home: "الرئيسية", Shop: "تسوّق", Search: "بحث", Bag: "السلة", Account: "حسابي", Menu: "القائمة", Wishlist: "المفضلة",
  "Search products, brands, concerns…": "ابحث عن منتج، ماركة أو مشكلة…", "Routine finder": "روتينك المثالي", "WhatsApp chat": "دردشة واتساب",
  Skincare: "العناية بالبشرة", "Skin Care": "العناية بالبشرة", Makeup: "مكياج", "Make Up": "مكياج", Hair: "الشعر", "Hair Care": "العناية بالشعر",
  Fragrance: "عطور", Fragrances: "عطور", Parapharmacy: "باراصيدلية", Supplements: "مكمّلات غذائية", "Body Care": "العناية بالجسم", "Body": "الجسم",
  "Mother & Baby": "الأم والطفل", "Baby": "الطفل", Men: "الرجال", "Sun Care": "الحماية من الشمس", Offers: "العروض", New: "جديد", "Best sellers": "الأكثر مبيعاً",
  Brands: "الماركات", "Services & Events": "الخدمات والفعاليات", Sale: "تخفيضات", "Black Friday": "الجمعة السوداء", Tools: "أدوات",
  // cards & product page
  "Add to cart": "أضف إلى السلة", "Add to bag": "أضف إلى السلة", "Choose option": "اختر", "Sold out": "نفدت الكمية", From: "من", options: "خيارات",
  "Choose an option": "اختر الحجم أو اللون", Save: "وفّر", Description: "الوصف", "How to use": "طريقة الاستعمال", Ingredients: "المكوّنات",
  "Delivery & returns": "التوصيل والإرجاع", Reviews: "التقييمات", "Write a review": "اكتب تقييماً", "Verified buyer": "مشترٍ موثّق",
  "No reviews yet — be the first.": "لا توجد تقييمات بعد — كن الأول.", "Pairs well with": "يتناسب مع", "Recently viewed": "شاهدتها مؤخراً",
  "You may also like": "قد يعجبك أيضاً", "Related products": "منتجات مشابهة", "Ask a pharmacist": "اسأل الصيدلي",
  "Free pharmacist advice on WhatsApp": "استشارة مجانية من صيدلي على واتساب", "Order now, delivered by": "اطلب الآن، يصلك قبل",
  "Free delivery on orders over": "توصيل مجاني للطلبات فوق", "Pay cash on delivery, by card or with Whish": "ادفع نقداً عند الاستلام، بالبطاقة أو عبر Whish",
  "Watch & learn": "شاهد وتعلّم", Videos: "فيديوهات",
  // cart & checkout
  "Your cart": "سلتك", "Your bag": "سلتك", "Your bag is empty": "سلتك فارغة", "Your bag is empty.": "سلتك فارغة.", Cart: "السلة", "Your cart is empty": "سلتك فارغة", "Your cart is empty.": "سلتك فارغة.", "Start shopping": "ابدأ التسوق",
  Checkout: "إتمام الشراء", "Order summary": "ملخص الطلب", Subtotal: "المجموع", Delivery: "التوصيل", Total: "المجموع الكلي", Free: "مجاني",
  Remove: "إزالة", Apply: "تطبيق", "Discount code": "رمز الخصم", "View cart": "عرض السلة",
  "away from free delivery": "متبقٍ للتوصيل المجاني", "You've unlocked free delivery": "حصلت على توصيل مجاني", "You're": "متبقٍ",
  "Join the club and earn points on this order": "انضم إلى النادي واكسب نقاطاً على هذا الطلب", "Birthday (optional)": "تاريخ الميلاد (اختياري)",
  // pop-up & club
  "Get 10% off": "احصل على خصم 10%", "Get my code": "أرسل لي الرمز", "Spin the wheel": "أدر العجلة", "No thanks": "لا شكراً",
  "Your email": "بريدك الإلكتروني", "or WhatsApp number": "أو رقم واتساب", "Use email": "استخدم البريد", "Use WhatsApp": "استخدم واتساب",
  "Your code": "رمزك", "Copy": "نسخ", "Copied": "تم النسخ", "Shop now": "تسوّق الآن", "Valid until": "صالح حتى",
  "Join": "انضم", "Points": "نقاط", "Tier": "المستوى", "Buy again": "اشترِ مجدداً", "Your orders": "طلباتك", "Find my account": "اعرض حسابي",
  "Phone number": "رقم الهاتف", "Order number": "رقم الطلب", "Join the club": "انضم إلى النادي",
  // pages
  "SuperScan": "تحليل البشرة", "Shade finder": "اختيار درجة الكريم الأساس", "Advent calendar": "روزنامة العروض",
  "Take a photo": "التقط صورة", "Analyse my skin": "حلّل بشرتي", "Your routine": "روتينك", "Add the whole routine": "أضف الروتين كاملاً",
  "Black Friday 2026": "الجمعة السوداء 2026",
  // footer
  "Customer care": "خدمة العملاء", "Follow us": "تابعنا", Newsletter: "النشرة البريدية", "About": "من نحن", Contact: "اتصل بنا",
};

export function tr(lang: Lang, s: string) {
  if (lang === "en" || !s) return s;
  const d = DICT[s] ?? DICT[s.trim()];
  if (lang === "fr") return d?.[0] ?? s;
  return d?.[1] ?? ar[s] ?? ar[s.trim()] ?? s;
}

/** Locale for dates and numbers. */
export const localeOf = (lang: Lang) => (lang === "fr" ? "fr-LB" : lang === "ar" ? "ar-LB" : "en-GB");

export const dirOf = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");
