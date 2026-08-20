/**
 * Common Saudi baqala product catalog for Nexttel POS import.
 *
 * - Real fast-moving SKUs only (no combinatorial filler)
 * - Categories in typical baqala aisle order
 * - Proper English + Arabic names and units
 * - No barcodes (scan later), no prices, no stock
 * - Unpublished drafts so they stay off POS until priced
 *
 * Run: node scripts/generate-baqala-catalog.mjs
 */
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "data");

const HEADERS = [
  "name",
  "name_ar",
  "sku",
  "barcode",
  "category",
  "unit",
  "supplier",
  "cost_price",
  "selling_price",
  "vat",
  "quantity",
  "min_stock",
  "published",
];

const ALLOWED_UNITS = new Set([
  "pcs",
  "unit",
  "kg",
  "g",
  "L",
  "ml",
  "pkt",
  "pack",
  "box",
  "carton",
  "bottle",
  "can",
  "jar",
  "bag",
  "sack",
  "roll",
  "doz",
  "pair",
  "bundle",
  "tray",
  "tube",
  "cup",
  "bucket",
  "m",
  "cotton",
  "sheet",
]);

/** @type {Array<{ en: string; ar: string; category: string; unit: string }>} */
const PRODUCTS = [];
let currentCategory = "";

function cat(name) {
  currentCategory = name;
}

function p(en, ar, unit) {
  if (!ALLOWED_UNITS.has(unit)) {
    throw new Error(`Unknown unit "${unit}" for ${en}`);
  }
  PRODUCTS.push({ en, ar, category: currentCategory, unit });
}

// ── 1. Dairy ──────────────────────────────────────────────────
cat("Dairy");
p("Almarai Fresh Milk 200ml", "حليب المراعي الطازج ٢٠٠ مل", "pcs");
p("Almarai Fresh Milk 1L", "حليب المراعي الطازج ١ لتر", "L");
p("Almarai Fresh Milk 2L", "حليب المراعي الطازج ٢ لتر", "L");
p("Almarai Low Fat Milk 1L", "حليب المراعي قليل الدسم ١ لتر", "L");
p("Almarai Full Fat UHT Milk 1L", "حليب المراعي كامل الدسم طويل الأجل ١ لتر", "L");
p("Almarai Laban 200ml", "لبن المراعي ٢٠٠ مل", "pcs");
p("Almarai Laban 1L", "لبن المراعي ١ لتر", "L");
p("Almarai Laban 2L", "لبن المراعي ٢ لتر", "L");
p("Almarai Yogurt Plain 170g", "زبادي المراعي الطبيعي ١٧٠ جم", "cup");
p("Almarai Yogurt Strawberry 170g", "زبادي المراعي بالفراولة ١٧٠ جم", "cup");
p("Almarai Yogurt Mixed Fruit 170g", "زبادي المراعي بالفواكه المشكلة ١٧٠ جم", "cup");
p("Almarai Greek Yogurt 150g", "زبادي المراعي اليوناني ١٥٠ جم", "cup");
p("Almarai Labneh 200g", "لبنة المراعي ٢٠٠ جم", "cup");
p("Almarai Labneh 400g", "لبنة المراعي ٤٠٠ جم", "cup");
p("Almarai Cheese Slices 200g", "شرائح جبن المراعي ٢٠٠ جم", "pkt");
p("Almarai Cheddar Cheese 400g", "جبن شيدر المراعي ٤٠٠ جم", "pkt");
p("Almarai Feta Cheese 200g", "جبنة فيتا المراعي ٢٠٠ جم", "pkt");
p("Almarai Feta Cheese 400g", "جبنة فيتا المراعي ٤٠٠ جم", "pkt");
p("Almarai Cream Cheese 150g", "جبنة كريمية المراعي ١٥٠ جم", "pkt");
p("Almarai Cream Cheese 250g", "جبنة كريمية المراعي ٢٥٠ جم", "pkt");
p("Almarai Butter 100g", "زبدة المراعي ١٠٠ جم", "pkt");
p("Almarai Butter 200g", "زبدة المراعي ٢٠٠ جم", "pkt");
p("Almarai Cooking Cream 250ml", "قشطة الطبخ المراعي ٢٥٠ مل", "pcs");
p("Almarai Fresh Cream 250ml", "قشطة طازجة المراعي ٢٥٠ مل", "pcs");
p("Nadec Fresh Milk 1L", "حليب نادك الطازج ١ لتر", "L");
p("Nadec Fresh Milk 2L", "حليب نادك الطازج ٢ لتر", "L");
p("Nadec Laban 1L", "لبن نادك ١ لتر", "L");
p("Nadec Yogurt 170g", "زبادي نادك ١٧٠ جم", "cup");
p("Nadec Cheese Spread 240g", "جبنة نادك قابلة للدهن ٢٤٠ جم", "pkt");
p("Nadec Butter 200g", "زبدة نادك ٢٠٠ جم", "pkt");
p("Saudia Fresh Milk 1L", "حليب السعودية الطازج ١ لتر", "L");
p("Saudia Laban 1L", "لبن السعودية ١ لتر", "L");
p("Saudia Evaporated Milk 410g", "حليب السعودية المبخر ٤١٠ جم", "can");
p("Saudia Condensed Milk 397g", "حليب السعودية المكثف ٣٩٧ جم", "can");
p("Nada Fresh Milk 1L", "حليب ندى الطازج ١ لتر", "L");
p("Nada Laban 1L", "لبن ندى ١ لتر", "L");
p("Alsafi Fresh Milk 1L", "حليب الصافي الطازج ١ لتر", "L");
p("Nido Full Cream Milk Powder 400g", "حليب نيدو المجفف كامل الدسم ٤٠٠ جم", "can");
p("Nido Full Cream Milk Powder 900g", "حليب نيدو المجفف كامل الدسم ٩٠٠ جم", "can");
p("Nido Full Cream Milk Powder 1.8kg", "حليب نيدو المجفف كامل الدسم ١٫٨ كجم", "can");
p("Puck Cream Cheese 240g", "جبنة بوك الكريمية ٢٤٠ جم", "box");
p("Puck Cream Cheese 500g", "جبنة بوك الكريمية ٥٠٠ جم", "box");
p("Puck Cheese Triangles 120g", "مثلثات جبن بوك ١٢٠ جم", "box");
p("Puck Cheese Triangles 240g", "مثلثات جبن بوك ٢٤٠ جم", "box");
p("Kraft Cheese Slices 200g", "شرائح جبن كرافت ٢٠٠ جم", "pkt");
p("Kraft Cheddar 250g", "جبن شيدر كرافت ٢٥٠ جم", "pkt");
p("Kiri Cheese Portions 8 pcs", "جبن كيري ٨ قطع", "box");
p("Philadelphia Cream Cheese 150g", "جبنة فيلادلفيا ١٥٠ جم", "pkt");
p("Lurpak Butter 200g", "زبدة لورباك ٢٠٠ جم", "pkt");
p("President Butter 200g", "زبدة بريزيدن ٢٠٠ جم", "pkt");
p("Rainbow Condensed Milk 397g", "حليب رينبو المكثف ٣٩٧ جم", "can");
p("Coffee Mate Creamer 400g", "كوفي ميت ٤٠٠ جم", "jar");
p("Almarai Ghee 400g", "سمن المراعي ٤٠٠ جم", "jar");
p("Almarai Ghee 800g", "سمن المراعي ٨٠٠ جم", "jar");

// ── 2. Eggs ───────────────────────────────────────────────────
cat("Eggs");
p("Fresh Eggs 6 pcs", "بيض طازج ٦ حبات", "pcs");
p("Fresh Eggs 15 pcs", "بيض طازج ١٥ حبة", "tray");
p("Fresh Eggs 30 pcs", "بيض طازج ٣٠ حبة", "tray");
p("Almarai Eggs 30 pcs", "بيض المراعي ٣٠ حبة", "tray");
p("White Eggs 30 pcs", "بيض أبيض ٣٠ حبة", "tray");
p("Brown Eggs 15 pcs", "بيض بني ١٥ حبة", "tray");

// ── 3. Bread & Bakery ─────────────────────────────────────────
cat("Bread & Bakery");
p("Arabic Bread 5 pcs", "خبز عربي ٥ أرغفة", "pkt");
p("Arabic Bread Large", "خبز عربي كبير", "pcs");
p("Samoli White 6 pcs", "صامولي أبيض ٦ حبات", "pkt");
p("Samoli Brown 6 pcs", "صامولي أسمر ٦ حبات", "pkt");
p("Toast White 600g", "توست أبيض ٦٠٠ جم", "pkt");
p("Toast Brown 600g", "توست أسمر ٦٠٠ جم", "pkt");
p("Burger Buns 6 pcs", "خبز برجر ٦ حبات", "pkt");
p("Hot Dog Buns 6 pcs", "خبز هوت دوغ ٦ حبات", "pkt");
p("Kaak 200g", "كعك ٢٠٠ جم", "pkt");
p("Croissant Plain 4 pcs", "كرواسون سادة ٤ حبات", "pkt");
p("Croissant Chocolate 4 pcs", "كرواسون شوكولاتة ٤ حبات", "pkt");
p("Cake Slice Chocolate", "قطعة كيك شوكولاتة", "pcs");
p("Cupcakes 4 pcs", "كب كيك ٤ حبات", "pkt");
p("Puff Pastry 400g", "عجينة puff pastry ٤٠٠ جم", "pkt");
p("Sambousek Cheese 6 pcs", "سمبوسة جبن ٦ حبات", "pkt");
p("Sambousek Meat 6 pcs", "سمبوسة لحم ٦ حبات", "pkt");
p("Fatayer Spinach 6 pcs", "فطائر سبانخ ٦ حبات", "pkt");
p("Fatayer Cheese 6 pcs", "فطائر جبن ٦ حبات", "pkt");
p("Maamoul Dates 400g", "معمول تمر ٤٠٠ جم", "box");
p("Rusk Toast 400g", "بقسماط ٤٠٠ جم", "pkt");

// ── 4. Water ──────────────────────────────────────────────────
cat("Water");
p("Nova Water 200ml", "مياه نوفا ٢٠٠ مل", "bottle");
p("Nova Water 330ml", "مياه نوفا ٣٣٠ مل", "bottle");
p("Nova Water 600ml", "مياه نوفا ٦٠٠ مل", "bottle");
p("Nova Water 1.5L", "مياه نوفا ١٫٥ لتر", "bottle");
p("Nova Water 330ml 40 pack", "مياه نوفا ٣٣٠ مل ٤٠ حبة", "pack");
p("Nova Water 1.5L 6 pack", "مياه نوفا ١٫٥ لتر ٦ حبات", "pack");
p("Berain Water 330ml", "مياه بيرين ٣٣٠ مل", "bottle");
p("Berain Water 600ml", "مياه بيرين ٦٠٠ مل", "bottle");
p("Berain Water 1.5L", "مياه بيرين ١٫٥ لتر", "bottle");
p("Berain Water 1.5L 6 pack", "مياه بيرين ١٫٥ لتر ٦ حبات", "pack");
p("Aquafina Water 330ml", "مياه أكوافينا ٣٣٠ مل", "bottle");
p("Aquafina Water 600ml", "مياه أكوافينا ٦٠٠ مل", "bottle");
p("Aquafina Water 1.5L", "مياه أكوافينا ١٫٥ لتر", "bottle");
p("Nestle Pure Life 330ml", "نستله بيور لايف ٣٣٠ مل", "bottle");
p("Nestle Pure Life 600ml", "نستله بيور لايف ٦٠٠ مل", "bottle");
p("Nestle Pure Life 1.5L", "نستله بيور لايف ١٫٥ لتر", "bottle");
p("Hana Water 600ml", "مياه هناء ٦٠٠ مل", "bottle");
p("Hana Water 1.5L", "مياه هناء ١٫٥ لتر", "bottle");
p("Naqi Water 600ml", "مياه نقي ٦٠٠ مل", "bottle");
p("Naqi Water 1.5L", "مياه نقي ١٫٥ لتر", "bottle");
p("Arwa Water 330ml", "مياه أروى ٣٣٠ مل", "bottle");
p("Arwa Water 1.5L", "مياه أروى ١٫٥ لتر", "bottle");
p("Evian Water 330ml", "مياه إيفيان ٣٣٠ مل", "bottle");
p("Evian Water 1.5L", "مياه إيفيان ١٫٥ لتر", "bottle");

// ── 5. Soft Drinks ────────────────────────────────────────────
cat("Soft Drinks");
p("Pepsi 330ml Can", "بيبسي ٣٣٠ مل علبة", "can");
p("Pepsi 330ml Bottle", "بيبسي ٣٣٠ مل زجاجة", "bottle");
p("Pepsi 1.25L", "بيبسي ١٫٢٥ لتر", "bottle");
p("Pepsi 2.25L", "بيبسي ٢٫٢٥ لتر", "bottle");
p("Diet Pepsi 330ml Can", "بيبسي دايت ٣٣٠ مل", "can");
p("7UP 330ml Can", "سفن أب ٣٣٠ مل علبة", "can");
p("7UP 1.25L", "سفن أب ١٫٢٥ لتر", "bottle");
p("7UP 2.25L", "سفن أب ٢٫٢٥ لتر", "bottle");
p("Mirinda Orange 330ml Can", "ميرندا برتقال ٣٣٠ مل", "can");
p("Mirinda Orange 2.25L", "ميرندا برتقال ٢٫٢٥ لتر", "bottle");
p("Mountain Dew 330ml Can", "ماونتن ديو ٣٣٠ مل", "can");
p("Coca-Cola 330ml Can", "كوكا كولا ٣٣٠ مل علبة", "can");
p("Coca-Cola 1.25L", "كوكا كولا ١٫٢٥ لتر", "bottle");
p("Coca-Cola 2.25L", "كوكا كولا ٢٫٢٥ لتر", "bottle");
p("Coca-Cola Zero 330ml Can", "كوكا كولا زيرو ٣٣٠ مل", "can");
p("Sprite 330ml Can", "سبرايت ٣٣٠ مل", "can");
p("Sprite 1.25L", "سبرايت ١٫٢٥ لتر", "bottle");
p("Fanta Orange 330ml Can", "فانتا برتقال ٣٣٠ مل", "can");
p("Fanta Orange 1.25L", "فانتا برتقال ١٫٢٥ لتر", "bottle");
p("Vimto 330ml Can", "فيمتو ٣٣٠ مل", "can");
p("Vimto 1L", "فيمتو ١ لتر", "bottle");
p("Vimto 2.25L", "فيمتو ٢٫٢٥ لتر", "bottle");
p("Kinza Cola 330ml Can", "كنزا كولا ٣٣٠ مل", "can");
p("Kinza Cola 2.25L", "كنزا كولا ٢٫٢٥ لتر", "bottle");
p("Schweppes Tonic 330ml", "شويبس تونيك ٣٣٠ مل", "can");
p("Schweppes Lemon 330ml", "شويبس ليمون ٣٣٠ مل", "can");

// ── 6. Juices ─────────────────────────────────────────────────
cat("Juices");
p("Almarai Orange Juice 200ml", "عصير المراعي برتقال ٢٠٠ مل", "pcs");
p("Almarai Orange Juice 1L", "عصير المراعي برتقال ١ لتر", "L");
p("Almarai Orange Juice 1.5L", "عصير المراعي برتقال ١٫٥ لتر", "L");
p("Almarai Apple Juice 200ml", "عصير المراعي تفاح ٢٠٠ مل", "pcs");
p("Almarai Apple Juice 1L", "عصير المراعي تفاح ١ لتر", "L");
p("Almarai Mango Juice 1L", "عصير المراعي مانجو ١ لتر", "L");
p("Almarai Mixed Fruit Juice 1L", "عصير المراعي فواكه مشكلة ١ لتر", "L");
p("Almarai Cocktail Juice 1.5L", "عصير المراعي كوكتيل ١٫٥ لتر", "L");
p("Al Rabie Orange Juice 200ml", "عصير الربيع برتقال ٢٠٠ مل", "pcs");
p("Al Rabie Orange Juice 1L", "عصير الربيع برتقال ١ لتر", "L");
p("Al Rabie Apple Juice 1L", "عصير الربيع تفاح ١ لتر", "L");
p("Al Rabie Mango Juice 1L", "عصير الربيع مانجو ١ لتر", "L");
p("Al Rabie Mixed Fruit Juice 1L", "عصير الربيع فواكه مشكلة ١ لتر", "L");
p("Al Rabie Cocktail Juice 1L", "عصير الربيع كوكتيل ١ لتر", "L");
p("Al Rabie Hibiscus Juice 1L", "عصير الربيع كركديه ١ لتر", "L");
p("Al Rabie Tamarind Juice 1L", "عصير الربيع تمر هندي ١ لتر", "L");
p("Nada Orange Juice 1L", "عصير ندى برتقال ١ لتر", "L");
p("Nada Apple Juice 1L", "عصير ندى تفاح ١ لتر", "L");
p("Rani Float Orange 240ml", "راني فلوت برتقال ٢٤٠ مل", "can");
p("Rani Float Mango 240ml", "راني فلوت مانجو ٢٤٠ مل", "can");
p("Rani Float Pineapple 240ml", "راني فلوت أناناس ٢٤٠ مل", "can");
p("Rani Float Mixed Fruit 240ml", "راني فلوت فواكه مشكلة ٢٤٠ مل", "can");
p("Suntop Orange 125ml", "صن توب برتقال ١٢٥ مل", "pcs");
p("Suntop Apple 125ml", "صن توب تفاح ١٢٥ مل", "pcs");
p("Suntop Mango 125ml", "صن توب مانجو ١٢٥ مل", "pcs");
p("Capri Sun Orange 200ml", "كابري سن برتقال ٢٠٠ مل", "pcs");
p("Capri Sun Apple 200ml", "كابري سن تفاح ٢٠٠ مل", "pcs");
p("Lacnor Orange Juice 1L", "عصير لاكنور برتقال ١ لتر", "L");
p("Rubicon Mango 1L", "روبيكون مانجو ١ لتر", "L");
p("Caesar Mango Juice 1L", "عصير سيزر مانجو ١ لتر", "L");

// ── 7. Tea & Coffee ───────────────────────────────────────────
cat("Tea & Coffee");
p("Lipton Yellow Label 25 bags", "شاي ليبتون ٢٥ كيس", "box");
p("Lipton Yellow Label 50 bags", "شاي ليبتون ٥٠ كيس", "box");
p("Lipton Yellow Label 100 bags", "شاي ليبتون ١٠٠ كيس", "box");
p("Lipton Yellow Label 200 bags", "شاي ليبتون ٢٠٠ كيس", "box");
p("Lipton Green Tea 25 bags", "شاي ليبتون الأخضر ٢٥ كيس", "box");
p("Lipton Loose Black Tea 200g", "شاي ليبتون سائب ٢٠٠ جم", "pkt");
p("Rabea Black Tea 100 bags", "شاي ربيع ١٠٠ كيس", "box");
p("Rabea Black Tea 200 bags", "شاي ربيع ٢٠٠ كيس", "box");
p("Rabea Green Tea 100 bags", "شاي ربيع الأخضر ١٠٠ كيس", "box");
p("Red Label Tea 100 bags", "شاي ريد ليبل ١٠٠ كيس", "box");
p("Ahmad Tea 100 bags", "شاي أحمد ١٠٠ كيس", "box");
p("Nescafe Classic 50g", "نسكافيه كلاسيك ٥٠ جم", "jar");
p("Nescafe Classic 100g", "نسكافيه كلاسيك ١٠٠ جم", "jar");
p("Nescafe Classic 200g", "نسكافيه كلاسيك ٢٠٠ جم", "jar");
p("Nescafe Gold 100g", "نسكافيه جولد ١٠٠ جم", "jar");
p("Nescafe Gold 200g", "نسكافيه جولد ٢٠٠ جم", "jar");
p("Nescafe 3 in 1 20 sachets", "نسكافيه ٣ في ١ ٢٠ ظرف", "box");
p("Nescafe 3 in 1 30 sachets", "نسكافيه ٣ في ١ ٣٠ ظرف", "box");
p("Al Ameed Arabic Coffee 250g", "قهوة العميد العربية ٢٥٠ جم", "pkt");
p("Al Ameed Arabic Coffee 500g", "قهوة العميد العربية ٥٠٠ جم", "pkt");
p("Al Ameed Turkish Coffee 250g", "قهوة العميد التركية ٢٥٠ جم", "pkt");
p("Al Ameed Cardamom Coffee 250g", "قهوة العميد بالهيل ٢٥٠ جم", "pkt");
p("Najjar Coffee 200g", "قهوة نجار ٢٠٠ جم", "pkt");
p("Lipton Iced Tea Peach 320ml", "شاي ليبتون المثلج خوخ ٣٢٠ مل", "bottle");

// ── 8. Energy & Malt Drinks ───────────────────────────────────
cat("Energy & Malt Drinks");
p("Red Bull 250ml", "ريد بول ٢٥٠ مل", "can");
p("Red Bull Sugar Free 250ml", "ريد بول خالي السكر ٢٥٠ مل", "can");
p("Sting Energy 250ml", "ستينج ٢٥٠ مل", "can");
p("Code Red 250ml", "كود رد ٢٥٠ مل", "can");
p("Power Horse 250ml", "باور هورس ٢٥٠ مل", "can");
p("Bison Energy 250ml", "بايسن ٢٥٠ مل", "can");
p("Barbican Apple 330ml", "باربيكان تفاح ٣٣٠ مل", "bottle");
p("Barbican Pomegranate 330ml", "باربيكان رمان ٣٣٠ مل", "bottle");
p("Barbican Raspberry 330ml", "باربيكان توت ٣٣٠ مل", "bottle");
p("Moussy Classic 330ml", "موسي كلاسيك ٣٣٠ مل", "bottle");
p("Moussy Apple 330ml", "موسي تفاح ٣٣٠ مل", "bottle");

// ── 9. Rice ───────────────────────────────────────────────────
cat("Rice");
p("Abu Kass Basmati Rice 2kg", "أرز أبو كاس بسمتي ٢ كجم", "bag");
p("Abu Kass Basmati Rice 5kg", "أرز أبو كاس بسمتي ٥ كجم", "bag");
p("Abu Kass Basmati Rice 10kg", "أرز أبو كاس بسمتي ١٠ كجم", "bag");
p("Al Osra Egyptian Rice 5kg", "أرز الأسرة مصري ٥ كجم", "bag");
p("Al Osra Egyptian Rice 10kg", "أرز الأسرة مصري ١٠ كجم", "bag");
p("India Gate Basmati 1kg", "أرز إنديا جيت بسمتي ١ كجم", "bag");
p("India Gate Basmati 5kg", "أرز إنديا جيت بسمتي ٥ كجم", "bag");
p("Mahmood Basmati Rice 5kg", "أرز محمود بسمتي ٥ كجم", "bag");
p("Mahmood Basmati Rice 10kg", "أرز محمود بسمتي ١٠ كجم", "bag");
p("Tilda Basmati Rice 1kg", "أرز تيلدا بسمتي ١ كجم", "bag");
p("Tilda Basmati Rice 5kg", "أرز تيلدا بسمتي ٥ كجم", "bag");
p("Sunwhite Calrose Rice 5kg", "أرز صن وايت كالروز ٥ كجم", "bag");
p("Sunwhite Calrose Rice 10kg", "أرز صن وايت كالروز ١٠ كجم", "bag");
p("Al Walimah Rice 5kg", "أرز الوليمة ٥ كجم", "bag");
p("Egyptian Rice 5kg", "أرز مصري ٥ كجم", "bag");
p("Basmati Rice 5kg", "أرز بسمتي ٥ كجم", "bag");

// ── 10. Oil & Ghee ────────────────────────────────────────────
cat("Oil & Ghee");
p("Afia Sunflower Oil 1.5L", "زيت عافية عباد الشمس ١٫٥ لتر", "bottle");
p("Afia Sunflower Oil 1.8L", "زيت عافية عباد الشمس ١٫٨ لتر", "bottle");
p("Afia Sunflower Oil 3.6L", "زيت عافية عباد الشمس ٣٫٦ لتر", "bottle");
p("Afia Corn Oil 1.5L", "زيت عافية ذرة ١٫٥ لتر", "bottle");
p("Shams Sunflower Oil 1.5L", "زيت شمس عباد الشمس ١٫٥ لتر", "bottle");
p("Shams Sunflower Oil 1.8L", "زيت شمس عباد الشمس ١٫٨ لتر", "bottle");
p("Hayat Sunflower Oil 1.5L", "زيت حياة عباد الشمس ١٫٥ لتر", "bottle");
p("Al Osra Sunflower Oil 1.5L", "زيت الأسرة عباد الشمس ١٫٥ لتر", "bottle");
p("Noor Sunflower Oil 1.5L", "زيت نور عباد الشمس ١٫٥ لتر", "bottle");
p("Mazola Corn Oil 1.5L", "زيت مازولا ذرة ١٫٥ لتر", "bottle");
p("Al Arabi Olive Oil 500ml", "زيت العربي زيتون ٥٠٠ مل", "bottle");
p("Al Arabi Olive Oil 1L", "زيت العربي زيتون ١ لتر", "bottle");
p("Rafael Salgado Olive Oil 500ml", "زيت رافاييل زيتون ٥٠٠ مل", "bottle");
p("Al Jouf Olive Oil 500ml", "زيت الجوف زيتون ٥٠٠ مل", "bottle");
p("Aseel Vegetable Ghee 1kg", "سمن أصيل ١ كجم", "pkt");
p("Safa Ghee 800g", "سمن صفا ٨٠٠ جم", "jar");
p("Safa Ghee 1.6kg", "سمن صفا ١٫٦ كجم", "jar");
p("Hayat Ghee 800g", "سمن حياة ٨٠٠ جم", "jar");

// ── 11. Flour, Sugar & Baking ─────────────────────────────────
cat("Flour, Sugar & Baking");
p("Al Othman Flour 1kg", "دقيق العثمان ١ كجم", "bag");
p("Al Othman Flour 2kg", "دقيق العثمان ٢ كجم", "bag");
p("Al Othman Flour 5kg", "دقيق العثمان ٥ كجم", "bag");
p("Al Othman Flour 10kg", "دقيق العثمان ١٠ كجم", "bag");
p("Al Walimah Flour 2kg", "دقيق الوليمة ٢ كجم", "bag");
p("White Sugar 1kg", "سكر أبيض ١ كجم", "bag");
p("White Sugar 2kg", "سكر أبيض ٢ كجم", "bag");
p("White Sugar 5kg", "سكر أبيض ٥ كجم", "bag");
p("White Sugar 10kg", "سكر أبيض ١٠ كجم", "bag");
p("Brown Sugar 1kg", "سكر بني ١ كجم", "bag");
p("Icing Sugar 500g", "سكر بودرة ٥٠٠ جم", "pkt");
p("Salt Iodized 700g", "ملح مدعم باليود ٧٠٠ جم", "pkt");
p("Salt Iodized 1kg", "ملح مدعم باليود ١ كجم", "pkt");
p("Baking Powder 100g", "بيكنج باودر ١٠٠ جم", "pkt");
p("Instant Yeast 10g", "خميرة فورية ١٠ جم", "pkt");
p("Corn Starch 400g", "نشا ذرة ٤٠٠ جم", "pkt");
p("Custard Powder 300g", "كاسترد ٣٠٠ جم", "pkt");
p("Jelly Strawberry 80g", "جيلي فراولة ٨٠ جم", "pkt");
p("Jelly Orange 80g", "جيلي برتقال ٨٠ جم", "pkt");
p("Vanilla Powder 20g", "فانيليا ٢٠ جم", "pkt");
p("Cake Mix Chocolate 500g", "خليط كيك شوكولاتة ٥٠٠ جم", "box");
p("Semolina 1kg", "سميد ١ كجم", "bag");

// ── 12. Pasta & Noodles ───────────────────────────────────────
cat("Pasta & Noodles");
p("Indomie Chicken 70g", "إندومي دجاج ٧٠ جم", "pkt");
p("Indomie Vegetable 70g", "إندومي خضار ٧٠ جم", "pkt");
p("Indomie Special Chicken 80g", "إندومي دجاج خاص ٨٠ جم", "pkt");
p("Indomie Fried Noodles 80g", "إندومي مقلي ٨٠ جم", "pkt");
p("Indomie BBQ Chicken 80g", "إندومي دجاج باربكيو ٨٠ جم", "pkt");
p("Indomie Cup Chicken", "إندومي كوب دجاج", "cup");
p("Maggi Noodles Chicken 70g", "ماجي نودلز دجاج ٧٠ جم", "pkt");
p("Maggi Noodles Masala 70g", "ماجي نودلز ماسالا ٧٠ جم", "pkt");
p("Barilla Spaghetti 500g", "باريللا سباغيتي ٥٠٠ جم", "pkt");
p("Barilla Penne 500g", "باريللا بيني ٥٠٠ جم", "pkt");
p("Panzani Spaghetti 500g", "بانزاني سباغيتي ٥٠٠ جم", "pkt");
p("Goody Spaghetti 500g", "قودي سباغيتي ٥٠٠ جم", "pkt");
p("Goody Macaroni 400g", "قودي مكرونة ٤٠٠ جم", "pkt");
p("Pasta Zara Spaghetti 400g", "باستا زارا سباغيتي ٤٠٠ جم", "pkt");
p("Pasta Zara Penne 400g", "باستا زارا بيني ٤٠٠ جم", "pkt");
p("Pasta Zara Fusilli 400g", "باستا زارا فوسيلي ٤٠٠ جم", "pkt");
p("Lasagna Sheets 500g", "شرائح لازانيا ٥٠٠ جم", "pkt");
p("Vermicelli 400g", "شعيرية ٤٠٠ جم", "pkt");

// ── 13. Pulses & Dry Goods ────────────────────────────────────
cat("Pulses & Dry Goods");
p("Red Lentils 1kg", "عدس أحمر ١ كجم", "bag");
p("Yellow Lentils 1kg", "عدس أصفر ١ كجم", "bag");
p("Chickpeas 1kg", "حمص حب ١ كجم", "bag");
p("White Beans 1kg", "فاصوليا بيضاء ١ كجم", "bag");
p("Kidney Beans 1kg", "فاصوليا حمراء ١ كجم", "bag");
p("Fava Beans Dry 1kg", "فول حب ١ كجم", "bag");
p("Split Peas 1kg", "بازلاء مجروشة ١ كجم", "bag");
p("Bulgur Fine 1kg", "برغل ناعم ١ كجم", "bag");
p("Bulgur Coarse 1kg", "برغل خشن ١ كجم", "bag");
p("Freekeh 1kg", "فريكة ١ كجم", "bag");
p("Couscous 1kg", "كسكسي ١ كجم", "bag");
p("Oats 500g", "شوفان ٥٠٠ جم", "pkt");
p("Quaker Oats 500g", "شوفان كويكر ٥٠٠ جم", "pkt");
p("Corn Flakes 500g", "كورن فليكس ٥٠٠ جم", "box");
p("Nesquik Cereal 375g", "نسكويك حبوب ٣٧٥ جم", "box");
p("Kellogg's Corn Flakes 375g", "كورن فليكس كيلوجز ٣٧٥ جم", "box");

// ── 14. Canned Food ───────────────────────────────────────────
cat("Canned Food");
p("California Garden Fava Beans 400g", "فول حدائق كاليفورنيا ٤٠٠ جم", "can");
p("California Garden Chickpeas 400g", "حمص حدائق كاليفورنيا ٤٠٠ جم", "can");
p("California Garden Hommos 400g", "حمص مهروس حدائق كاليفورنيا ٤٠٠ جم", "can");
p("California Garden Kidney Beans 400g", "فاصوليا حمراء حدائق كاليفورنيا ٤٠٠ جم", "can");
p("California Garden Tuna 185g", "تونة حدائق كاليفورنيا ١٨٥ جم", "can");
p("California Garden Peas 400g", "بازلاء حدائق كاليفورنيا ٤٠٠ جم", "can");
p("California Garden Mixed Vegetables 400g", "خضار مشكلة حدائق كاليفورنيا ٤٠٠ جم", "can");
p("Goody Tuna in Water 85g", "تونة قودي بالماء ٨٥ جم", "can");
p("Goody Tuna in Water 185g", "تونة قودي بالماء ١٨٥ جم", "can");
p("Goody Tuna in Oil 185g", "تونة قودي بالزيت ١٨٥ جم", "can");
p("Goody Tomato Paste 135g", "معجون طماطم قودي ١٣٥ جم", "can");
p("Goody Tomato Paste 400g", "معجون طماطم قودي ٤٠٠ جم", "can");
p("Goody Chickpeas 400g", "حمص قودي ٤٠٠ جم", "can");
p("Goody White Beans 400g", "فاصوليا بيضاء قودي ٤٠٠ جم", "can");
p("Goody Sweet Corn 340g", "ذرة قودي ٣٤٠ جم", "can");
p("Goody Mushrooms 400g", "فطر قودي ٤٠٠ جم", "can");
p("Al Rabie Tomato Paste 70g", "معجون طماطم الربيع ٧٠ جم", "can");
p("Al Rabie Tomato Paste 135g", "معجون طماطم الربيع ١٣٥ جم", "can");
p("Al Rabie Tomato Paste 400g", "معجون طماطم الربيع ٤٠٠ جم", "can");
p("Hana Tuna 170g", "تونة هناء ١٧٠ جم", "can");
p("Green Giant Corn 340g", "ذرة جرين جاينت ٣٤٠ جم", "can");
p("Canned Pineapple 565g", "أناناس معلب ٥٦٥ جم", "can");
p("Goody Green Olives 450g", "زيتون أخضر قودي ٤٥٠ جم", "jar");
p("Goody Black Olives 450g", "زيتون أسود قودي ٤٥٠ جم", "jar");
p("Goody Mixed Pickles 680g", "مخلل مشكل قودي ٦٨٠ جم", "jar");
p("Chtoora Mixed Pickles 600g", "مخلل شتورة مشكل ٦٠٠ جم", "jar");
p("Chtoora Cucumber Pickles 600g", "مخلل خيار شتورة ٦٠٠ جم", "jar");

// ── 15. Sauces & Condiments ───────────────────────────────────
cat("Sauces & Condiments");
p("Heinz Ketchup 300g", "كاتشب هاينز ٣٠٠ جم", "bottle");
p("Heinz Ketchup 570g", "كاتشب هاينز ٥٧٠ جم", "bottle");
p("Heinz Ketchup 935g", "كاتشب هاينز ٩٣٥ جم", "bottle");
p("Al Rabie Ketchup 500g", "كاتشب الربيع ٥٠٠ جم", "bottle");
p("Hellmann's Mayonnaise 400g", "مايونيز هيلمانز ٤٠٠ جم", "jar");
p("American Garden Mayonnaise 340g", "مايونيز أمريكان جاردن ٣٤٠ جم", "jar");
p("American Garden Ketchup 567g", "كاتشب أمريكان جاردن ٥٦٧ جم", "bottle");
p("American Garden Mustard 340g", "خردل أمريكان جاردن ٣٤٠ جم", "bottle");
p("American Garden Hot Sauce 355ml", "صوص حار أمريكان جاردن ٣٥٥ مل", "bottle");
p("Heinz Mustard 200g", "خردل هاينز ٢٠٠ جم", "bottle");
p("Heinz BBQ Sauce 400g", "صوص باربكيو هاينز ٤٠٠ جم", "bottle");
p("Maggi Chicken Cubes 24 pcs", "مكعبات ماجي دجاج ٢٤ حبة", "box");
p("Maggi Beef Cubes 24 pcs", "مكعبات ماجي لحم ٢٤ حبة", "box");
p("Knorr Chicken Cubes 24 pcs", "مكعبات كنور دجاج ٢٤ حبة", "box");
p("Soy Sauce 300ml", "صوص صويا ٣٠٠ مل", "bottle");
p("Chili Sauce 300ml", "صوص فلفل حار ٣٠٠ مل", "bottle");
p("White Vinegar 1L", "خل أبيض ١ لتر", "bottle");
p("Apple Cider Vinegar 500ml", "خل تفاح ٥٠٠ مل", "bottle");
p("Tahini 450g", "طحينة ٤٥٠ جم", "jar");
p("Tahini 900g", "طحينة ٩٠٠ جم", "jar");
p("Date Molasses 450g", "دبس تمر ٤٥٠ جم", "jar");
p("Honey 250g", "عسل ٢٥٠ جم", "jar");
p("Honey 500g", "عسل ٥٠٠ جم", "jar");
p("Honey 1kg", "عسل ١ كجم", "jar");
p("Strawberry Jam 400g", "مربى فراولة ٤٠٠ جم", "jar");
p("Apricot Jam 400g", "مربى مشمش ٤٠٠ جم", "jar");
p("Mixed Fruit Jam 400g", "مربى فواكه مشكلة ٤٠٠ جم", "jar");
p("Nutella 350g", "نوتيلا ٣٥٠ جم", "jar");
p("Nutella 750g", "نوتيلا ٧٥٠ جم", "jar");
p("Peanut Butter 340g", "زبدة فول سوداني ٣٤٠ جم", "jar");
p("Halawa Plain 500g", "حلاوة طحينية سادة ٥٠٠ جم", "pkt");
p("Halawa Chocolate 500g", "حلاوة طحينية شوكولاتة ٥٠٠ جم", "pkt");

// ── 16. Spices ────────────────────────────────────────────────
cat("Spices");
p("Black Pepper Ground 100g", "فلفل أسود مطحون ١٠٠ جم", "pkt");
p("White Pepper Ground 50g", "فلفل أبيض مطحون ٥٠ جم", "pkt");
p("Cumin Ground 100g", "كمون مطحون ١٠٠ جم", "pkt");
p("Coriander Ground 100g", "كزبرة مطحونة ١٠٠ جم", "pkt");
p("Turmeric 100g", "كركم ١٠٠ جم", "pkt");
p("Paprika 100g", "بابريكا ١٠٠ جم", "pkt");
p("Chili Powder 100g", "شطة مطحونة ١٠٠ جم", "pkt");
p("Cinnamon Stick 50g", "قرفة عيدان ٥٠ جم", "pkt");
p("Cinnamon Ground 50g", "قرفة مطحونة ٥٠ جم", "pkt");
p("Cardamom Green 50g", "هيل أخضر ٥٠ جم", "pkt");
p("Cloves 50g", "قرنفل ٥٠ جم", "pkt");
p("Bay Leaves 20g", "ورق غار ٢٠ جم", "pkt");
p("Garlic Powder 100g", "ثوم بودرة ١٠٠ جم", "pkt");
p("Onion Powder 100g", "بصل بودرة ١٠٠ جم", "pkt");
p("Ginger Powder 100g", "زنجبيل مطحون ١٠٠ جم", "pkt");
p("Sumac 100g", "سماق ١٠٠ جم", "pkt");
p("Zaatar 200g", "زعتر ٢٠٠ جم", "pkt");
p("Seven Spices 100g", "سبع بهارات ١٠٠ جم", "pkt");
p("Kabsa Spices 100g", "بهارات كبسة ١٠٠ جم", "pkt");
p("Biryani Spices 100g", "بهارات برياني ١٠٠ جم", "pkt");
p("Mandi Spices 100g", "بهارات مندي ١٠٠ جم", "pkt");
p("Chicken Seasoning 100g", "بهارات دجاج ١٠٠ جم", "pkt");
p("Meat Seasoning 100g", "بهارات لحم ١٠٠ جم", "pkt");
p("Dried Lime 100g", "ليمون أسود مجفف ١٠٠ جم", "pkt");
p("Dried Mint 50g", "نعناع مجفف ٥٠ جم", "pkt");
p("Saffron 1g", "زعفران ١ جم", "pkt");
p("Oregano 50g", "أوريجانو ٥٠ جم", "pkt");

// ── 17. Chips & Snacks ────────────────────────────────────────
cat("Chips & Snacks");
p("Lays Classic 14g", "ليز ملح ١٤ جم", "pkt");
p("Lays Classic 43g", "ليز ملح ٤٣ جم", "pkt");
p("Lays Classic 170g", "ليز ملح ١٧٠ جم", "pkt");
p("Lays Cheese 43g", "ليز جبن ٤٣ جم", "pkt");
p("Lays Ketchup 43g", "ليز كاتشب ٤٣ جم", "pkt");
p("Lays Chili 43g", "ليز حار ٤٣ جم", "pkt");
p("Lays Salt & Vinegar 43g", "ليز ملح وخل ٤٣ جم", "pkt");
p("Doritos Nacho Cheese 44g", "دوريتوس جبن ٤٤ جم", "pkt");
p("Doritos Sweet Chili 44g", "دوريتوس سويت تشيلي ٤٤ جم", "pkt");
p("Doritos Family Pack 180g", "دوريتوس عائلي ١٨٠ جم", "pkt");
p("Cheetos Crunchy 35g", "تشيتوس ٣٥ جم", "pkt");
p("Cheetos Flamin Hot 35g", "تشيتوس حار ٣٥ جم", "pkt");
p("Pringles Original 40g", "برينجلز أصلي ٤٠ جم", "can");
p("Pringles Original 165g", "برينجلز أصلي ١٦٥ جم", "can");
p("Pringles Sour Cream 165g", "برينجلز ساور كريم ١٦٥ جم", "can");
p("Pringles Paprika 165g", "برينجلز بابريكا ١٦٥ جم", "can");
p("Tasali Classic 40g", "تسالي كلاسيك ٤٠ جم", "pkt");
p("Kitco Chips 30g", "كيتكو ٣٠ جم", "pkt");
p("Popcorn Microwave 3 bags", "فشار مايكروويف ٣ أكياس", "box");
p("Sunflower Seeds 200g", "لب شمس ٢٠٠ جم", "pkt");
p("Pumpkin Seeds 200g", "لب قرع ٢٠٠ جم", "pkt");
p("Bugles 40g", "باجلز ٤٠ جم", "pkt");

// ── 18. Biscuits ──────────────────────────────────────────────
cat("Biscuits");
p("Oreo Original 66g", "أوريو ٦٦ جم", "pkt");
p("Oreo Original 133g", "أوريو ١٣٣ جم", "pkt");
p("Oreo Family Pack 300g", "أوريو عائلي ٣٠٠ جم", "pkt");
p("McVitie's Digestive 250g", "ماكفيتيز دايجستف ٢٥٠ جم", "pkt");
p("McVitie's Digestive 400g", "ماكفيتيز دايجستف ٤٠٠ جم", "pkt");
p("Tiffany Cream Biscuits 400g", "تيفاني بسكويت كريمة ٤٠٠ جم", "pkt");
p("Tiffany Marie 400g", "تيفاني ماري ٤٠٠ جم", "pkt");
p("Tiffany Digestive 400g", "تيفاني دايجستف ٤٠٠ جم", "pkt");
p("Loacker Quadratini 125g", "لواكر ١٢٥ جم", "pkt");
p("Bahlsen Leibniz 200g", "بالزن ٢٠٠ جم", "pkt");
p("Ulker Biscuits 200g", "أولكر بسكويت ٢٠٠ جم", "pkt");
p("Tuc Crackers 100g", "تاك ١٠٠ جم", "pkt");
p("Ritz Crackers 200g", "ريتز ٢٠٠ جم", "pkt");
p("Petit Beurre 200g", "بتي بور ٢٠٠ جم", "pkt");
p("Lotus Biscoff 250g", "لوتس بيسكوف ٢٥٠ جم", "pkt");
p("Eti Crax 50g", "إيتي كراكس ٥٠ جم", "pkt");
p("Halwani Maamoul 400g", "حلواني معمول ٤٠٠ جم", "box");
p("Nabil Biscuits 400g", "نبيل بسكويت ٤٠٠ جم", "pkt");

// ── 19. Chocolate & Candy ─────────────────────────────────────
cat("Chocolate & Candy");
p("KitKat 2 Finger", "كيت كات إصبعان", "pcs");
p("KitKat 4 Finger", "كيت كات ٤ أصابع", "pcs");
p("Snickers 50g", "سنيكرز ٥٠ جم", "pcs");
p("Twix 50g", "تويكس ٥٠ جم", "pcs");
p("Mars 51g", "مارس ٥١ جم", "pcs");
p("Bounty 57g", "باونتي ٥٧ جم", "pcs");
p("Galaxy Smooth Milk 42g", "جالاكسي ٤٢ جم", "pcs");
p("Galaxy Smooth Milk 110g", "جالاكسي ١١٠ جم", "pcs");
p("Milky Way 52g", "ميلكي واي ٥٢ جم", "pcs");
p("M&M Peanut 45g", "إم آند إم فول سوداني ٤٥ جم", "pkt");
p("M&M Chocolate 45g", "إم آند إم شوكولاتة ٤٥ جم", "pkt");
p("Kinder Bueno", "كيندر بوينو", "pcs");
p("Kinder Surprise", "كيندر سبرايز", "pcs");
p("Toblerone 100g", "توبليرون ١٠٠ جم", "pcs");
p("Cadbury Dairy Milk 45g", "كادبوري ديري ميلك ٤٥ جم", "pcs");
p("Cadbury Flake 32g", "كادبوري فليك ٣٢ جم", "pcs");
p("Lion Bar", "ليون بار", "pcs");
p("Ulker Hobby 80g", "أولكر هوبي ٨٠ جم", "pcs");
p("Ulker Albeni 34g", "أولكر ألبيني ٣٤ جم", "pcs");
p("Haribo Goldbears 80g", "هاريبو ٨٠ جم", "pkt");
p("Mentos Mint", "مينتوس نعناع", "pcs");
p("Orbit Gum", "أوربت علكة", "pcs");
p("Extra Gum", "إكسترا علكة", "pcs");
p("Trident Gum", "ترايدنت علكة", "pcs");
p("Halls Cough Drops", "هولز حبوب", "pkt");
p("Chiclets", "شيكليت", "pcs");
p("Chupa Chups Lollipop", "تشوبا تشوبس", "pcs");
p("Toffee Classic", "توفي", "pkt");

// ── 20. Dates & Nuts ──────────────────────────────────────────
cat("Dates & Nuts");
p("Sukkari Dates 1kg", "تمر سكري ١ كجم", "box");
p("Khalas Dates 1kg", "تمر خلاص ١ كجم", "box");
p("Ajwa Dates 500g", "تمر عجوة ٥٠٠ جم", "box");
p("Mixed Nuts 250g", "مكسرات مشكلة ٢٥٠ جم", "pkt");
p("Pistachios 250g", "فستق ٢٥٠ جم", "pkt");
p("Cashews 250g", "كاجو ٢٥٠ جم", "pkt");
p("Almonds 250g", "لوز ٢٥٠ جم", "pkt");
p("Peanuts Roasted 250g", "فول سوداني محمص ٢٥٠ جم", "pkt");
p("Walnuts 250g", "جوز ٢٥٠ جم", "pkt");

// ── 21. Frozen Food ───────────────────────────────────────────
cat("Frozen Food");
p("Americana Chicken Nuggets 400g", "ناجتس أمريكانا ٤٠٠ جم", "pkt");
p("Americana Chicken Burger 4 pcs", "برجر دجاج أمريكانا ٤ قطع", "pkt");
p("Americana Beef Burger 4 pcs", "برجر لحم أمريكانا ٤ قطع", "pkt");
p("Americana Minced Beef 400g", "لحم بقري مفروم أمريكانا ٤٠٠ جم", "pkt");
p("Americana Minced Lamb 400g", "لحم غنم مفروم أمريكانا ٤٠٠ جم", "pkt");
p("Sadia Whole Chicken 900g", "دجاج ساديا كامل ٩٠٠ جم", "pkt");
p("Sadia Chicken Breast 900g", "صدر دجاج ساديا ٩٠٠ جم", "pkt");
p("Sadia Chicken Nuggets 400g", "ناجتس ساديا ٤٠٠ جم", "pkt");
p("Al Watania Whole Chicken", "دجاج الوطنية كامل", "pcs");
p("Al Watania Chicken Pieces", "قطع دجاج الوطنية", "pkt");
p("French Fries 1kg", "بطاطس مقلية مجمدة ١ كجم", "pkt");
p("Frozen Mixed Vegetables 400g", "خضار مشكلة مجمدة ٤٠٠ جم", "pkt");
p("Frozen Green Peas 400g", "بازلاء مجمدة ٤٠٠ جم", "pkt");
p("Frozen Okra 400g", "بامية مجمدة ٤٠٠ جم", "pkt");
p("Frozen Molokhia 400g", "ملوخية مجمدة ٤٠٠ جم", "pkt");
p("Samosa Vegetable 12 pcs", "سمبوسة خضار ١٢ حبة", "pkt");
p("Spring Rolls 12 pcs", "سبرينج رول ١٢ حبة", "pkt");
p("Kibbeh 12 pcs", "كبة ١٢ حبة", "pkt");
p("Falafel 12 pcs", "فلافل ١٢ حبة", "pkt");
p("Fish Fingers 400g", "أصابع سمك ٤٠٠ جم", "pkt");
p("Frozen Pizza Margherita", "بيتزا مارغريتا مجمدة", "pcs");
p("Paratha Plain 5 pcs", "براثا سادة ٥ قطع", "pkt");

// ── 22. Ice Cream ─────────────────────────────────────────────
cat("Ice Cream");
p("Almarai Ice Cream Vanilla 1.5L", "آيس كريم المراعي فانيليا ١٫٥ لتر", "pcs");
p("Almarai Ice Cream Chocolate 1.5L", "آيس كريم المراعي شوكولاتة ١٫٥ لتر", "pcs");
p("Almarai Ice Cream Cup", "كأس آيس كريم المراعي", "pcs");
p("Magnum Classic", "ماغنوم كلاسيك", "pcs");
p("Cornetto Classico", "كورنيتو كلاسيكو", "pcs");
p("Paddle Pop", "باديل بوب", "pcs");
p("Igloo Ice Cream Tub 1.5L", "آيس كريم إغلو ١٫٥ لتر", "pcs");
p("Kwality Walls Cup", "كأس كواليتي وولز", "pcs");

// ── 23. Meat & Poultry ────────────────────────────────────────
cat("Meat & Poultry");
p("Fresh Whole Chicken", "دجاج طازج كامل", "kg");
p("Fresh Chicken Breast", "صدر دجاج طازج", "kg");
p("Fresh Chicken Thighs", "أفخاذ دجاج طازجة", "kg");
p("Minced Beef", "لحم بقري مفروم", "kg");
p("Minced Lamb", "لحم غنم مفروم", "kg");
p("Beef Steak", "ستيك لحم بقري", "kg");
p("Lamb Chops", "ريش غنم", "kg");
p("Chicken Sausages", "سجق دجاج", "pkt");
p("Beef Mortadella 250g", "مرتديلا بقري ٢٥٠ جم", "pkt");
p("Turkey Slices 200g", "شرائح ديك رومي ٢٠٠ جم", "pkt");
p("Chicken Franks 400g", "نقانق دجاج ٤٠٠ جم", "pkt");

// ── 24. Fresh Produce ─────────────────────────────────────────
cat("Fresh Produce");
p("Tomato", "طماطم", "kg");
p("Cucumber", "خيار", "kg");
p("White Onion", "بصل أبيض", "kg");
p("Red Onion", "بصل أحمر", "kg");
p("Potato", "بطاطس", "kg");
p("Carrot", "جزر", "kg");
p("Green Bell Pepper", "فلفل أخضر", "kg");
p("Red Bell Pepper", "فلفل أحمر", "kg");
p("Eggplant", "باذنجان", "kg");
p("Zucchini", "كوسة", "kg");
p("Cabbage", "ملفوف", "pcs");
p("Lettuce", "خس", "pcs");
p("Spinach Bundle", "سبانخ حزمة", "bundle");
p("Coriander Bundle", "كزبرة حزمة", "bundle");
p("Parsley Bundle", "بقدونس حزمة", "bundle");
p("Mint Bundle", "نعناع حزمة", "bundle");
p("Garlic 250g", "ثوم ٢٥٠ جم", "pkt");
p("Fresh Ginger 250g", "زنجبيل طازج ٢٥٠ جم", "pkt");
p("Lemon", "ليمون", "kg");
p("Orange", "برتقال", "kg");
p("Red Apple", "تفاح أحمر", "kg");
p("Green Apple", "تفاح أخضر", "kg");
p("Banana", "موز", "kg");
p("Green Grapes", "عنب أخضر", "kg");
p("Watermelon", "بطيخ", "pcs");
p("Melon", "شمام", "pcs");
p("Pomegranate", "رمان", "kg");
p("Mango", "مانجو", "kg");
p("Dates Loose", "تمر سائب", "kg");

// ── 25. Baby Care ─────────────────────────────────────────────
cat("Baby Care");
p("Pampers Size 1", "بامبرز مقاس ١", "pkt");
p("Pampers Size 2", "بامبرز مقاس ٢", "pkt");
p("Pampers Size 3", "بامبرز مقاس ٣", "pkt");
p("Pampers Size 4", "بامبرز مقاس ٤", "pkt");
p("Pampers Size 5", "بامبرز مقاس ٥", "pkt");
p("Pampers Size 6", "بامبرز مقاس ٦", "pkt");
p("Fine Baby Size 3", "فاين بيبي مقاس ٣", "pkt");
p("Fine Baby Size 4", "فاين بيبي مقاس ٤", "pkt");
p("Fine Baby Size 5", "فاين بيبي مقاس ٥", "pkt");
p("Sanita Bambi Size 3", "سانيتا بامبي مقاس ٣", "pkt");
p("Sanita Bambi Size 4", "سانيتا بامبي مقاس ٤", "pkt");
p("Molfix Size 4", "مولفيكس مقاس ٤", "pkt");
p("Baby Wipes 80 pcs", "مناديل أطفال ٨٠ حبة", "pkt");
p("Johnson's Baby Shampoo 200ml", "شامبو جونسون أطفال ٢٠٠ مل", "bottle");
p("Johnson's Baby Oil 200ml", "زيت جونسون أطفال ٢٠٠ مل", "bottle");
p("Johnson's Baby Powder 200g", "بودرة جونسون أطفال ٢٠٠ جم", "pcs");
p("Johnson's Baby Lotion 200ml", "لوشن جونسون أطفال ٢٠٠ مل", "bottle");
p("Cerelac Rice 200g", "سيريلاك أرز ٢٠٠ جم", "box");
p("Cerelac Wheat 200g", "سيريلاك قمح ٢٠٠ جم", "box");
p("Nido 1+ 400g", "نيدو ١+ ٤٠٠ جم", "can");
p("Nido 3+ 400g", "نيدو ٣+ ٤٠٠ جم", "can");
p("Baby Bottle 250ml", "رضاعة ٢٥٠ مل", "pcs");

// ── 26. Personal Care ─────────────────────────────────────────
cat("Personal Care");
p("Colgate Toothpaste 125ml", "معجون كولجيت ١٢٥ مل", "tube");
p("Signal Toothpaste 120ml", "معجون سيجنال ١٢٠ مل", "tube");
p("Closeup Toothpaste 120ml", "معجون كلوس أب ١٢٠ مل", "tube");
p("Sensodyne Toothpaste 100ml", "معجون سنسوداين ١٠٠ مل", "tube");
p("Oral-B Toothbrush", "فرشاة أسنان أورال بي", "pcs");
p("Toothbrush Soft", "فرشاة أسنان ناعمة", "pcs");
p("Head & Shoulders Shampoo 400ml", "شامبو هيد آند شولدرز ٤٠٠ مل", "bottle");
p("Pantene Shampoo 400ml", "شامبو بانتين ٤٠٠ مل", "bottle");
p("Pantene Conditioner 360ml", "بلسم بانتين ٣٦٠ مل", "bottle");
p("Sunsilk Shampoo 400ml", "شامبو صانسيلك ٤٠٠ مل", "bottle");
p("Dove Shampoo 400ml", "شامبو دوف ٤٠٠ مل", "bottle");
p("Dove Body Wash 500ml", "غسول جسم دوف ٥٠٠ مل", "bottle");
p("Dove Soap 135g", "صابون دوف ١٣٥ جم", "pcs");
p("Lux Soap 125g", "صابون لوكس ١٢٥ جم", "pcs");
p("Dettol Soap 125g", "صابون ديتول ١٢٥ جم", "pcs");
p("Lifebuoy Soap 125g", "صابون لايف بوي ١٢٥ جم", "pcs");
p("Fa Soap 125g", "صابون فا ١٢٥ جم", "pcs");
p("Palmolive Shower Gel 500ml", "شاور بالموليف ٥٠٠ مل", "bottle");
p("Nivea Cream 150ml", "كريم نيفيا ١٥٠ مل", "jar");
p("Nivea Body Lotion 400ml", "لوشن نيفيا ٤٠٠ مل", "bottle");
p("Nivea Deodorant 150ml", "مزيل عرق نيفيا ١٥٠ مل", "can");
p("Rexona Deodorant 150ml", "مزيل عرق ركسونا ١٥٠ مل", "can");
p("Gillette Blue 2 Razor 2 pcs", "جيليت بلو ٢ قطعتان", "pkt");
p("Gillette Shaving Foam 200ml", "رغوة حلاقة جيليت ٢٠٠ مل", "can");
p("Always Pads 10 pcs", "فوط أولويز ١٠ قطع", "pkt");
p("Always Night Pads 8 pcs", "فوط أولويز ليلية ٨ قطع", "pkt");
p("Kotex Pads 10 pcs", "فوط كوتكس ١٠ قطع", "pkt");
p("Vaseline 100ml", "فازلين ١٠٠ مل", "jar");
p("Cotton Pads 80 pcs", "أقراص قطن ٨٠ حبة", "pkt");
p("Cotton Buds 200 pcs", "أعواد أذن ٢٠٠ حبة", "box");
p("Hand Sanitizer 500ml", "معقم يدين ٥٠٠ مل", "bottle");
p("Hair Gel 250ml", "جل شعر ٢٥٠ مل", "jar");
p("Comb", "مشط", "pcs");
p("Nail Clipper", "قصاصة أظافر", "pcs");

// ── 27. Laundry & Cleaning ────────────────────────────────────
cat("Laundry & Cleaning");
p("Ariel Powder 3kg", "أريال مسحوق ٣ كجم", "pkt");
p("Ariel Liquid 2.5L", "أريال سائل ٢٫٥ لتر", "bottle");
p("Persil Powder 3kg", "برسيل مسحوق ٣ كجم", "pkt");
p("Persil Liquid 2.5L", "برسيل سائل ٢٫٥ لتر", "bottle");
p("Tide Powder 3kg", "تايد مسحوق ٣ كجم", "pkt");
p("Tide Liquid 2.5L", "تايد سائل ٢٫٥ لتر", "bottle");
p("Fairy Dish Soap 1L", "فيري سائل جلي ١ لتر", "bottle");
p("Fairy Dish Soap Lemon 1L", "فيري ليمون ١ لتر", "bottle");
p("Pril Dish Soap 1L", "بريل سائل جلي ١ لتر", "bottle");
p("Dettol Antiseptic 750ml", "ديتول مطهر ٧٥٠ مل", "bottle");
p("Dettol Antiseptic 1L", "ديتول مطهر ١ لتر", "bottle");
p("Dettol Hand Wash 200ml", "ديتول غسول يدين ٢٠٠ مل", "bottle");
p("Clorox Bleach 1.89L", "كلوركس ١٫٨٩ لتر", "bottle");
p("Clorox Bleach 3.78L", "كلوركس ٣٫٧٨ لتر", "bottle");
p("Clorox Toilet Cleaner 750ml", "كلوركس منظف مرحاض ٧٥٠ مل", "bottle");
p("Harpic Toilet Cleaner 750ml", "هاربيك ٧٥٠ مل", "bottle");
p("Jif Cream Cleaner 500ml", "جيف ٥٠٠ مل", "bottle");
p("Mr Muscle Kitchen 750ml", "مستر ماسل مطبخ ٧٥٠ مل", "bottle");
p("Ajax Floor Cleaner 1.5L", "أجاكس أرضيات ١٫٥ لتر", "bottle");
p("Flash Floor Cleaner 1.5L", "فلاش أرضيات ١٫٥ لتر", "bottle");
p("Glass Cleaner 750ml", "منظف زجاج ٧٥٠ مل", "bottle");
p("Abaya Wash 1L", "سائل غسيل عبايات ١ لتر", "bottle");
p("Fabric Softener 2L", "منعم أقمشة ٢ لتر", "bottle");
p("Dish Sponge 3 pcs", "إسفنج جلي ٣ حبات", "pkt");
p("Steel Wool 6 pcs", "سلك جلي ٦ حبات", "pkt");
p("Trash Bags Large 30 pcs", "أكياس نفايات كبيرة ٣٠ كيس", "roll");
p("Trash Bags Medium 30 pcs", "أكياس نفايات وسط ٣٠ كيس", "roll");
p("Cleaning Gloves", "قفازات تنظيف", "pair");
p("Insect Spray 400ml", "مبيد حشرات ٤٠٠ مل", "can");
p("Air Freshener Spray 300ml", "معطر جو ٣٠٠ مل", "can");
p("Air Freshener Gel 150g", "معطر جو جل ١٥٠ جم", "jar");

// ── 28. Paper & Tissue ────────────────────────────────────────
cat("Paper & Tissue");
p("Fine Facial Tissue 150 sheets", "مناديل فاين ١٥٠ ورقة", "box");
p("Fine Facial Tissue 5 pack", "مناديل فاين ٥ علب", "pack");
p("Fine Toilet Paper 4 rolls", "ورق تواليت فاين ٤ رول", "pack");
p("Fine Toilet Paper 12 rolls", "ورق تواليت فاين ١٢ رول", "pack");
p("Fine Kitchen Towel 2 rolls", "مناشف مطبخ فاين رولان", "pack");
p("Sanita Facial Tissue", "مناديل سانيتا", "box");
p("Sanita Toilet Paper 8 rolls", "ورق تواليت سانيتا ٨ رول", "pack");
p("Kleenex Facial Tissue", "مناديل كلينكس", "box");
p("Wet Wipes 80 pcs", "مناديل مبللة ٨٠ حبة", "pkt");
p("Aluminum Foil 30m", "ورق ألمنيوم ٣٠ م", "roll");
p("Cling Film 30m", "نايلون حفظ ٣٠ م", "roll");
p("Baking Paper 20 sheets", "ورق زبدة ٢٠ ورقة", "roll");
p("Paper Cups 50 pcs", "أكواب ورق ٥٠ حبة", "pkt");
p("Plastic Cups 50 pcs", "أكواب بلاستيك ٥٠ حبة", "pkt");
p("Plastic Plates 25 pcs", "أطباق بلاستيك ٢٥ حبة", "pkt");
p("Paper Plates 25 pcs", "أطباق ورق ٢٥ حبة", "pkt");
p("Plastic Spoons 50 pcs", "ملاعق بلاستيك ٥٠ حبة", "pkt");
p("Garbage Bags Small 50 pcs", "أكياس نفايات صغيرة ٥٠ كيس", "roll");

// ── 29. Household ─────────────────────────────────────────────
cat("Household");
p("AA Batteries 4 pcs", "بطاريات AA ٤ حبات", "pkt");
p("AAA Batteries 4 pcs", "بطاريات AAA ٤ حبات", "pkt");
p("Disposable Lighter", "ولاعة", "pcs");
p("Matches 10 boxes", "عيدان ثقاب ١٠ علب", "box");
p("LED Bulb 9W", "لمبة LED ٩ واط", "pcs");
p("Duct Tape", "شريط لاصق عريض", "roll");
p("Super Glue", "صمغ قوي", "pcs");
p("Candles 6 pcs", "شموع ٦ حبات", "pkt");
p("Incense Bakhoor", "بخور", "pkt");
p("Charcoal 3kg", "فحم ٣ كجم", "bag");
p("Broom", "مكنسة", "pcs");
p("Mop", "ممسحة", "pcs");
p("Mosquito Coil", "مبيد ناموس لولبي", "box");

function escapeCsvCell(value) {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function skuFor(index) {
  return `BAQ-${String(index + 1).padStart(4, "0")}`;
}

const seen = new Map();
for (const [i, product] of PRODUCTS.entries()) {
  const key = product.en.trim().toLowerCase();
  if (seen.has(key)) {
    throw new Error(`Duplicate English name: "${product.en}" (also #${seen.get(key) + 1})`);
  }
  seen.set(key, i);
}

const rows = PRODUCTS.map((product, i) => [
  product.en,
  product.ar,
  skuFor(i),
  "",
  product.category,
  product.unit,
  "",
  "0.00",
  "0.00",
  "default",
  "0",
  "0",
  "no",
]);

mkdirSync(OUT_DIR, { recursive: true });

const csv = `\uFEFF${[HEADERS.map(escapeCsvCell).join(","), ...rows.map((row) => row.map(escapeCsvCell).join(","))].join("\r\n")}\r\n`;
const csvPath = join(OUT_DIR, "baqala-common-products.csv");
writeFileSync(csvPath, csv, "utf8");

const workbook = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
sheet["!cols"] = HEADERS.map((header) => ({
  wch: Math.min(40, Math.max(12, header.length + 4)),
}));
XLSX.utils.book_append_sheet(workbook, sheet, "Products");
const xlsxPath = join(OUT_DIR, "baqala-common-products.xlsx");
XLSX.writeFile(workbook, xlsxPath);

const oldCsv = join(OUT_DIR, "baqala-products-1000.csv");
const oldXlsx = join(OUT_DIR, "baqala-products-1000.xlsx");
for (const stale of [oldCsv, oldXlsx]) {
  if (existsSync(stale)) unlinkSync(stale);
}

const counts = new Map();
for (const product of PRODUCTS) {
  counts.set(product.category, (counts.get(product.category) || 0) + 1);
}

console.log(`Generated ${PRODUCTS.length} products in ${counts.size} categories`);
console.log("");
for (const [name, count] of counts) {
  console.log(`  ${String(count).padStart(3)}  ${name}`);
}
console.log("");
console.log(`CSV:  ${csvPath}`);
console.log(`XLSX: ${xlsxPath}`);
console.log("");
console.log("Import via Products → Import / Export.");
console.log("Prices and stock are 0. Products are unpublished until you set a selling price.");
