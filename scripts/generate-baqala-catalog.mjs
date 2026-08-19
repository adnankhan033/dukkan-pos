/**
 * Generates ~1000 common Saudi baqala products for NexttelPOS import.
 * Run: node scripts/generate-baqala-catalog.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
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
  "quantity",
  "min_stock",
  "published",
];

/** @type {Array<{ en: string; ar: string; category: string; unit: string; price: number; cost?: number }>} */
const PRODUCTS = [];

function add(en, ar, category, unit, price, cost) {
  PRODUCTS.push({
    en,
    ar,
    category,
    unit,
    price,
    cost: cost ?? Math.round(price * 0.75 * 100) / 100,
  });
}

function brandItems(brand, brandAr, category, unit, items) {
  for (const [en, ar, size, price] of items) {
    add(`${brand} ${en}${size ? ` ${size}` : ""}`, `${brandAr} ${ar}${size ? ` ${size}` : ""}`, category, unit, price);
  }
}

// ── Dairy & Eggs ──────────────────────────────────────────────
brandItems("Almarai", "المراعي", "Dairy & Eggs", "L", [
  ["Fresh Milk", "حليب طازج", "1L", 6.5],
  ["Fresh Milk", "حليب طازج", "2L", 12.0],
  ["Low Fat Milk", "حليب قليل الدسم", "1L", 6.0],
  ["Laban", "لبن", "1L", 5.5],
  ["Laban", "لبن", "2L", 10.0],
  ["Yogurt Plain", "زبادي طبيعي", "170g", 2.5],
  ["Yogurt Strawberry", "زبادي فراولة", "170g", 2.5],
  ["Cheese Slices", "جبن شرائح", "200g", 12.0],
  ["Cheddar Cheese", "جبن شيدر", "400g", 18.0],
  ["Feta Cheese", "جبنة فيتا", "400g", 15.0],
  ["Cream Cheese", "جبنة كريمية", "250g", 10.0],
  ["Butter", "زبدة", "200g", 8.0],
  ["Ghee", "سمن", "800g", 35.0],
  ["Eggs", "بيض", "30 pcs", 22.0],
]);

brandItems("Nadec", "نادك", "Dairy & Eggs", "L", [
  ["Fresh Milk", "حليب طازج", "1L", 6.0],
  ["Fresh Milk", "حليب طازج", "2L", 11.5],
  ["Laban", "لبن", "1L", 5.0],
  ["Yogurt", "زبادي", "170g", 2.0],
  ["Cheese Spread", "جبنة مSpreadable", "240g", 9.0],
  ["Butter", "زبدة", "200g", 7.5],
]);

brandItems("Al Rabie", "الربيع", "Dairy & Eggs", "L", [
  ["Orange Juice", "عصير برتقال", "1L", 8.0],
  ["Apple Juice", "عصير تفاح", "1L", 8.0],
  ["Mango Juice", "عصير مانجو", "1L", 9.0],
  ["Mixed Fruit Juice", "عصير فواكه مشكلة", "1L", 8.5],
  ["Tomato Paste", "معجون طماطم", "400g", 5.0],
]);

brandItems("Saudia", "سعودia", "Dairy & Eggs", "L", [
  ["Fresh Milk", "حليب طازج", "1L", 5.5],
  ["Laban", "لبن", "1L", 4.5],
  ["Evaporated Milk", "حليب م evaporated", "410g", 6.0],
  ["Condensed Milk", "حليب م condensed", "397g", 7.0],
]);

// ── Beverages ─────────────────────────────────────────────────
brandItems("Aquafina", "أكوafina", "Beverages", "bottle", [
  ["Water", "مياه", "600ml", 1.5],
  ["Water", "مياه", "1.5L", 2.5],
]);
brandItems("Nova", "nova", "Beverages", "bottle", [
  ["Water", "مياه", "330ml", 1.0],
  ["Water", "مياه", "600ml", 1.5],
  ["Water", "مياه", "1.5L", 2.0],
  ["Water", "مياه", "2.25L", 3.0],
]);
brandItems("Pepsi", "بيبسي", "Beverages", "can", [
  ["Cola", "كولا", "330ml", 2.5],
  ["Cola", "كولا", "2.25L", 8.0],
  ["Diet Cola", "دايت كولا", "330ml", 2.5],
  ["Mirinda Orange", "ميرندا برتقال", "330ml", 2.5],
  ["7UP", "سeven up", "330ml", 2.5],
]);
brandItems("Coca-Cola", "كوكا كولا", "Beverages", "can", [
  ["Cola", "كولا", "330ml", 2.5],
  ["Cola Zero", "كولا زيرو", "330ml", 2.5],
  ["Sprite", "سبرايت", "330ml", 2.5],
  ["Fanta Orange", "فانتا برتقال", "330ml", 2.5],
]);
brandItems("Lipton", "لipton", "Beverages", "box", [
  ["Black Tea", "شاي أسود", "100 bags", 15.0],
  ["Green Tea", "شاي أخضر", "25 bags", 12.0],
]);
brandItems("Rabea", "ربea", "Beverages", "box", [
  ["Black Tea", "شاي أسود", "100 bags", 12.0],
  ["Green Tea", "شاي أخضر", "100 bags", 14.0],
]);
brandItems("Nescafe", "نسكafe", "Beverages", "jar", [
  ["Classic", "كلاسيك", "200g", 35.0],
  ["Gold", "جold", "200g", 55.0],
  ["3in1", "٣ في ١", "20 sachets", 18.0],
]);
brandItems("Al Ameed", "العمeed", "Beverages", "pkt", [
  ["Arabic Coffee", "قهوة عربية", "250g", 25.0],
  ["Turkish Coffee", "قهوة تركية", "250g", 22.0],
  ["Cardamom Coffee", "قهوة بالهيل", "250g", 28.0],
]);

const BEVERAGES = [
  ["Red Bull Energy Drink", "ريd Bull مشروب طاقة", "250ml", 12.0, "can"],
  ["Sting Energy Drink", "ستing مشروب طاقة", "250ml", 3.0, "can"],
  ["Power Horse Energy Drink", "باور هورس", "250ml", 5.0, "can"],
  ["Capri Sun Orange", "كapri sun برتقال", "200ml", 2.0, "pcs"],
  ["Suntop Juice Orange", "صن تop برتقال", "125ml", 1.5, "pcs"],
  ["Suntop Juice Apple", "صن تop تفاح", "125ml", 1.5, "pcs"],
  ["Suntop Juice Mango", "صن تop مانجو", "125ml", 1.5, "pcs"],
  ["Rani Float Orange", "رani فلوت برتقال", "240ml", 2.5, "can"],
  ["Rani Float Mango", "رani فلوت مانجو", "240ml", 2.5, "can"],
  ["Barbican Apple", "barbican تفاح", "330ml", 3.0, "bottle"],
  ["Barbican Pomegranate", "barbican رمان", "330ml", 3.0, "bottle"],
  ["Moussy Classic", "moussy كلاسيك", "330ml", 4.0, "bottle"],
  ["Hollster Malt", "hollster malt", "330ml", 3.5, "can"],
];
for (const [en, ar, size, price, unit] of BEVERAGES) {
  add(`${en} ${size}`, `${ar} ${size}`, "Beverages", unit, price);
}

// ── Snacks ────────────────────────────────────────────────────
brandItems("Lays", "lays", "Snacks & Confectionery", "pkt", [
  ["Classic Salted", "ملح كلاسيك", "43g", 3.0],
  ["Cheese", "جبن", "43g", 3.0],
  ["Ketchup", "كاتشup", "43g", 3.0],
  ["Chili", "حار", "43g", 3.0],
  ["Family Pack Classic", "عائلي كلاسيك", "170g", 10.0],
]);
brandItems("Doritos", "doritos", "Snacks & Confectionery", "pkt", [
  ["Nacho Cheese", "nacho cheese", "44g", 3.5],
  ["Sweet Chili", "sweet chili", "44g", 3.5],
  ["Family Pack", "عائلي", "180g", 12.0],
]);
brandItems("Cheetos", "cheetos", "Snacks & Confectionery", "pkt", [
  ["Crunchy Cheese", "جبn crunchy", "35g", 3.0],
  ["Flamin Hot", "flamin hot", "35g", 3.0],
]);
brandItems("Pringles", "pringles", "Snacks & Confectionery", "can", [
  ["Original", "original", "40g", 5.0],
  ["Sour Cream", "sour cream", "40g", 5.0],
  ["BBQ", "bbq", "165g", 15.0],
]);
brandItems("Galaxy", "galaxy", "Snacks & Confectionery", "pcs", [
  ["Milk Chocolate", "شokolat milk", "42g", 3.5],
  ["Dark Chocolate", "شokolat dark", "42g", 3.5],
  ["Smooth Milk Bar", "smooth milk", "110g", 8.0],
]);
brandItems("Cadbury", "cadbury", "Snacks & Confectionery", "pcs", [
  ["Dairy Milk", "dairy milk", "45g", 3.5],
  ["Flake", "flake", "32g", 3.0],
  ["Bournville", "bournville", "45g", 4.0],
]);
brandItems("KitKat", "kitkat", "Snacks & Confectionery", "pcs", [
  ["4 Finger", "4 fingers", "41.5g", 3.5],
  ["Chunky", "chunky", "40g", 4.0],
]);
brandItems("Snickers", "snickers", "Snacks & Confectionery", "pcs", [
  ["Bar", "bar", "50g", 3.5],
  ["Mini Pack", "mini", "180g", 12.0],
]);
brandItems("M&M", "m&m", "Snacks & Confectionery", "pkt", [
  ["Peanut", "peanut", "45g", 4.0],
  ["Chocolate", "chocolate", "45g", 4.0],
]);
brandItems("Oreo", "oreo", "Snacks & Confectionery", "pkt", [
  ["Original", "original", "137g", 6.0],
  ["Double Stuff", "double stuff", "137g", 7.0],
  ["Mini", "mini", "55g", 3.5],
]);
brandItems("Tiffany", "tiffany", "Snacks & Confectionery", "pkt", [
  ["Cream Biscuits", "بiscuits cream", "400g", 8.0],
  ["Marie Biscuits", "بiscuits marie", "400g", 7.0],
  ["Digestive", "digestive", "400g", 9.0],
]);
brandItems("Ulker", "ulker", "Snacks & Confectionery", "pkt", [
  ["Hobby Chocolate", "hobby", "80g", 4.0],
  ["Albeni", "albeni", "34g", 2.5],
  ["Metro", "metro", "36g", 2.5],
]);

const SNACKS = [
  ["Halawa Plain", "حلawa سada", "500g", 12.0, "pkt"],
  ["Halawa Chocolate", "حلawa شokolat", "500g", 14.0, "pkt"],
  ["Tahini", "طحينة", "900g", 18.0, "jar"],
  ["Peanuts Roasted", "فول سoudani", "250g", 8.0, "pkt"],
  ["Cashews Roasted", "كaju", "250g", 25.0, "pkt"],
  ["Pistachios", "فستق", "250g", 35.0, "pkt"],
  ["Almonds", "لوز", "250g", 28.0, "pkt"],
  ["Dates Ajwa", "تمر عجوة", "1kg", 45.0, "pkt"],
  ["Dates Sukkari", "تمر سkkari", "1kg", 35.0, "pkt"],
  ["Dates Khalas", "تمر خلاص", "1kg", 30.0, "pkt"],
  ["Choco Balls", "كرات شokolat", "150g", 5.0, "pkt"],
  ["Popcorn Microwave", "فشار microwave", "3 bags", 8.0, "box"],
  ["Sunflower Seeds", "لب sunflower", "200g", 5.0, "pkt"],
  ["Pumpkin Seeds", "لب pumpkin", "200g", 6.0, "pkt"],
];
for (const [en, ar, size, price, unit] of SNACKS) {
  add(`${en} ${size}`, `${ar} ${size}`, "Snacks & Confectionery", unit, price);
}

// ── Rice, Grains & Pasta ──────────────────────────────────────
brandItems("Abu Kass", "abu kass", "Rice & Grains", "sack", [
  ["Basmati Rice", "أرز basmati", "5kg", 45.0],
  ["Basmati Rice", "أرز basmati", "10kg", 85.0],
  ["Calrose Rice", "أرز calrose", "5kg", 35.0],
]);
brandItems("Sunwhite", "sunwhite", "Rice & Grains", "sack", [
  ["Basmati Rice", "أرز basmati", "5kg", 42.0],
  ["Basmati Rice", "أرز basmati", "10kg", 80.0],
]);
brandItems("Al Alali", "al alali", "Rice & Grains", "pkt", [
  ["All Purpose Flour", "دقيق", "2kg", 8.0],
  ["Self Rising Flour", "دقيق self rising", "2kg", 9.0],
  ["Semolina", "semolina", "1kg", 6.0],
  ["Corn Flour", "corn flour", "400g", 5.0],
  ["Baking Powder", "baking powder", "100g", 4.0],
  ["Vanilla Powder", "vanilla", "20g", 3.0],
]);
brandItems("Barilla", "barilla", "Rice & Grains", "pkt", [
  ["Spaghetti", "spaghetti", "500g", 8.0],
  ["Penne", "penne", "500g", 8.0],
  ["Fusilli", "fusilli", "500g", 8.0],
]);
brandItems("Pasta Zara", "pasta zara", "Rice & Grains", "pkt", [
  ["Spaghetti", "spaghetti", "400g", 4.0],
  ["Macaroni", "macaroni", "400g", 4.0],
  ["Penne", "penne", "400g", 4.0],
  ["Fusilli", "fusilli", "400g", 4.0],
  ["Lasagna", "lasagna", "500g", 7.0],
]);

const GRAINS = [
  ["White Sugar", "سugar أبيض", "1kg", 4.0, "pkt"],
  ["Brown Sugar", "سugar بني", "1kg", 5.0, "pkt"],
  ["Salt Fine", "ملح fine", "700g", 2.0, "pkt"],
  ["Salt Coarse", "ملح coarse", "700g", 2.0, "pkt"],
  ["Lentils Red", "عدس أحمر", "1kg", 8.0, "pkt"],
  ["Lentils Yellow", "عدس أصفر", "1kg", 7.0, "pkt"],
  ["Chickpeas", "حمص", "1kg", 10.0, "pkt"],
  ["White Beans", "فاصولia بيضاء", "1kg", 12.0, "pkt"],
  ["Freekeh", "freekeh", "1kg", 15.0, "pkt"],
  ["Bulgur Fine", "bulgur fine", "1kg", 8.0, "pkt"],
  ["Bulgur Coarse", "bulgur coarse", "1kg", 8.0, "pkt"],
  ["Oats", "شofan", "500g", 8.0, "pkt"],
  ["Corn Flakes", "corn flakes", "500g", 12.0, "box"],
  ["Cereal Honey Loops", "cereal honey", "375g", 15.0, "box"],
  ["Cereal Choco Rings", "cereal choco", "375g", 15.0, "box"],
  ["Quaker Oats", "quaker oats", "500g", 14.0, "pkt"],
  ["Couscous", "couscous", "1kg", 12.0, "pkt"],
  ["Vermicelli", "vermicelli", "400g", 4.0, "pkt"],
  ["Orzo", "orzo", "400g", 5.0, "pkt"],
];
for (const [en, ar, size, price, unit] of GRAINS) {
  add(`${en} ${size}`, `${ar} ${size}`, "Rice & Grains", unit, price);
}

// ── Oils & Ghee ───────────────────────────────────────────────
brandItems("Afia", "afia", "Oils & Ghee", "L", [
  ["Sunflower Oil", "زيت sunflower", "1.5L", 18.0],
  ["Sunflower Oil", "زيت sunflower", "2L", 22.0],
  ["Corn Oil", "زيت corn", "1.5L", 20.0],
  ["Olive Oil", "زيت olive", "500ml", 25.0],
  ["Olive Oil Extra Virgin", "زيت olive extra", "500ml", 35.0],
]);
brandItems("Hayat", "hayat", "Oils & Ghee", "L", [
  ["Sunflower Oil", "زيت sunflower", "1.5L", 16.0],
  ["Sunflower Oil", "زيت sunflower", "2L", 20.0],
  ["Canola Oil", "زيت canola", "1.5L", 18.0],
]);
brandItems("Al Osra", "al osra", "Oils & Ghee", "L", [
  ["Sunflower Oil", "زيت sunflower", "1.5L", 17.0],
  ["Corn Oil", "زيت corn", "1.5L", 19.0],
]);
brandItems("Safa", "safa", "Oils & Ghee", "L", [
  ["Ghee", "سمن", "800g", 32.0],
  ["Ghee", "سمن", "1.6kg", 60.0],
]);

const OILS = [
  ["Vegetable Ghee", "سمن vegetable", "1kg", 22.0, "pkt"],
  ["Samna Baladi", "سمن baladi", "800g", 28.0, "jar"],
  ["Sesame Oil", "زيت sesame", "500ml", 20.0, "bottle"],
  ["Coconut Oil", "زيت coconut", "500ml", 25.0, "jar"],
];
for (const [en, ar, size, price, unit] of OILS) {
  add(`${en} ${size}`, `${ar} ${size}`, "Oils & Ghee", unit, price);
}

// ── Canned & Preserved ────────────────────────────────────────
brandItems("Goody", "goody", "Canned & Preserved", "can", [
  ["Tuna in Water", "تuna in water", "185g", 8.0],
  ["Tuna in Oil", "تuna in oil", "185g", 8.0],
  ["Tomato Paste", "معجون tomate", "135g", 3.0],
  ["Tomato Paste", "معجون tomate", "400g", 5.0],
  ["Peeled Tomatoes", "طماطم peeled", "400g", 4.0],
  ["Chickpeas", "حمص canned", "400g", 4.0],
  ["White Beans", "فاصولia canned", "400g", 4.0],
  ["Sweet Corn", "ذرة sweet", "340g", 4.0],
  ["Mushrooms", "فطر", "400g", 6.0],
  ["Pickles Mixed", "مخلل mixed", "680g", 8.0],
  ["Olives Green", "زيتون green", "450g", 10.0],
  ["Olives Black", "زيتون black", "450g", 10.0],
]);
brandItems("California Garden", "california garden", "Canned & Preserved", "can", [
  ["Tuna Light", "تuna light", "185g", 7.0],
  ["Tomato Paste", "معجون tomate", "400g", 4.5],
  ["Fava Beans", "فول", "400g", 3.5],
  ["Chickpeas", "حمص", "400g", 3.5],
  ["Peas", "بازilla", "400g", 4.0],
  ["Mixed Vegetables", "خضار mixed", "400g", 4.0],
]);
brandItems("Heinz", "heinz", "Canned & Preserved", "bottle", [
  ["Ketchup", "كاتchup", "570g", 12.0],
  ["Ketchup", "كاتchup", "340g", 8.0],
  ["Mayonnaise", "mayonnaise", "400g", 10.0],
  ["Mustard", "mustard", "200g", 8.0],
  ["BBQ Sauce", "bbq sauce", "400g", 12.0],
]);
brandItems("American Garden", "american garden", "Canned & Preserved", "bottle", [
  ["Ketchup", "كاتchup", "567g", 10.0],
  ["Mayonnaise", "mayonnaise", "340g", 9.0],
  ["Mustard", "mustard", "340g", 8.0],
  ["Hot Sauce", "hot sauce", "355ml", 10.0],
  ["Pancake Syrup", "pancake syrup", "710ml", 18.0],
]);

const CANNED = [
  ["Vinegar White", "خل white", "1L", 4.0, "bottle"],
  ["Vinegar Apple", "خل apple", "500ml", 5.0, "bottle"],
  ["Soy Sauce", "soy sauce", "300ml", 8.0, "bottle"],
  ["Hot Pepper Sauce", "hot pepper", "88ml", 6.0, "bottle"],
  ["Tahini Sesame", "طحينة sesame", "450g", 12.0, "jar"],
  ["Hummus Ready", "حمص ready", "400g", 8.0, "jar"],
  ["Baba Ghanoush", "baba ghanoush", "400g", 10.0, "jar"],
  ["Labneh Jar", "labneh jar", "900g", 15.0, "jar"],
  ["Jam Strawberry", "مربى strawberry", "400g", 8.0, "jar"],
  ["Jam Apricot", "مربى apricot", "400g", 8.0, "jar"],
  ["Honey Natural", "عسل natural", "500g", 35.0, "jar"],
  ["Peanut Butter", "peanut butter", "340g", 12.0, "jar"],
  ["Nutella", "nutella", "350g", 18.0, "jar"],
  ["Nutella", "nutella", "750g", 32.0, "jar"],
];
for (const [en, ar, size, price, unit] of CANNED) {
  add(`${en} ${size}`, `${ar} ${size}`, "Canned & Preserved", unit, price);
}

// ── Spices & Seasonings ───────────────────────────────────────
brandItems("Al Baker", "al baker", "Spices & Seasonings", "pkt", [
  ["Black Pepper Ground", "فلفل أسود", "100g", 8.0],
  ["Cumin Ground", "كمون", "100g", 6.0],
  ["Coriander Ground", "كزبرة", "100g", 5.0],
  ["Turmeric", "كركم", "100g", 5.0],
  ["Cinnamon Stick", "قرفة", "50g", 8.0],
  ["Cardamom Green", "هيل", "50g", 25.0],
  ["Cloves", "قرنفل", "50g", 12.0],
  ["Bay Leaves", "ورق غار", "20g", 4.0],
  ["Mixed Spice Biryani", "بهارات biryani", "100g", 8.0],
  ["Mixed Spice Kabsa", "بهارات kabsa", "100g", 8.0],
  ["Mixed Spice Mandi", "بهارات mandi", "100g", 8.0],
  ["Chicken Seasoning", "seasoning chicken", "100g", 6.0],
  ["Meat Seasoning", "seasoning meat", "100g", 6.0],
  ["Fish Seasoning", "seasoning fish", "100g", 6.0],
  ["Saffron", "زعfran", "1g", 15.0],
  ["Sumac", "sumac", "100g", 8.0],
  ["Seven Spices", "سبع بهارات", "100g", 8.0],
]);

const SPICES = [
  ["Dried Lime Black", "ليمون أسود", "100g", 10.0, "pkt"],
  ["Dried Mint", "نعnaع مجفف", "50g", 5.0, "pkt"],
  ["Oregano", "oregano", "50g", 5.0, "pkt"],
  ["Paprika", "paprika", "100g", 6.0, "pkt"],
  ["Chili Powder", "chili powder", "100g", 6.0, "pkt"],
  ["Garlic Powder", "garlic powder", "100g", 6.0, "pkt"],
  ["Onion Powder", "onion powder", "100g", 6.0, "pkt"],
  ["Ginger Powder", "ginger powder", "100g", 6.0, "pkt"],
  ["Nutmeg", "nutmeg", "50g", 10.0, "pkt"],
  ["Star Anise", "yansoon", "50g", 12.0, "pkt"],
  ["MSG", "msg", "100g", 5.0, "pkt"],
  ["Bouillon Chicken", "bouillon chicken", "24 cubes", 8.0, "box"],
  ["Bouillon Beef", "bouillon beef", "24 cubes", 8.0, "box"],
  ["Stock Powder Vegetable", "stock vegetable", "12 cubes", 6.0, "box"],
];
for (const [en, ar, size, price, unit] of SPICES) {
  add(`${en} ${size}`, `${ar} ${size}`, "Spices & Seasonings", unit, price);
}

// ── Bread & Bakery ────────────────────────────────────────────
const BAKERY = [
  ["Arabic Bread", "خبز عربي", "5 pcs", 3.0, "pkt"],
  ["Samar Bread", "خبز samar", "6 pcs", 4.0, "pkt"],
  ["Toast White", "toast white", "600g", 6.0, "pkt"],
  ["Toast Brown", "toast brown", "600g", 7.0, "pkt"],
  ["Croissant Plain", "كرواسan", "4 pcs", 8.0, "pkt"],
  ["Croissant Chocolate", "كرواسan chocolate", "4 pcs", 10.0, "pkt"],
  ["Pita Bread", "خبز pita", "6 pcs", 4.0, "pkt"],
  ["Burger Buns", "burger buns", "6 pcs", 5.0, "pkt"],
  ["Hot Dog Buns", "hot dog buns", "6 pcs", 5.0, "pkt"],
  ["Cake Plain", "cake plain", "400g", 12.0, "pcs"],
  ["Cake Chocolate", "cake chocolate", "400g", 14.0, "pcs"],
  ["Muffin Blueberry", "muffin blueberry", "4 pcs", 10.0, "pkt"],
  ["Danish Pastry", "danish", "4 pcs", 12.0, "pkt"],
  ["Puff Pastry", "puff pastry", "400g", 10.0, "pkt"],
  ["Sambousek Cheese", "sambousek cheese", "6 pcs", 8.0, "pkt"],
  ["Sambousek Meat", "sambousek meat", "6 pcs", 10.0, "pkt"],
  ["Fatayer Spinach", "fatayer spinach", "6 pcs", 8.0, "pkt"],
  ["Fatayer Cheese", "fatayer cheese", "6 pcs", 8.0, "pkt"],
];
for (const [en, ar, size, price, unit] of BAKERY) {
  add(`${en} ${size}`, `${ar} ${size}`, "Bread & Bakery", unit, price);
}

// ── Frozen ────────────────────────────────────────────────────
brandItems("Sadia", "sadia", "Frozen Foods", "pkt", [
  ["Chicken Whole", "دجاج whole", "900g", 18.0],
  ["Chicken Breast", "صدر دجاج", "900g", 22.0],
  ["Chicken Wings", "أwings", "900g", 16.0],
  ["Chicken Nuggets", "nuggets", "400g", 12.0],
  ["Chicken Strips", "strips", "400g", 14.0],
  ["Beef Mince", "لحم مفروم", "500g", 20.0],
  ["Beef Burger Patties", "burger patties", "4 pcs", 15.0],
  ["French Fries", "بطاطس fries", "1kg", 12.0],
  ["Mixed Vegetables", "خضار mixed", "400g", 8.0],
  ["Green Peas", "بازilla", "400g", 6.0],
  ["Corn Kernels", "ذرة", "400g", 6.0],
  ["Pizza Margherita", "pizza margherita", "350g", 12.0],
  ["Pizza Pepperoni", "pizza pepperoni", "350g", 14.0],
]);
brandItems("Al Kabeer", "al kabeer", "Frozen Foods", "pkt", [
  ["Paratha Plain", "paratha", "5 pcs", 8.0],
  ["Paratha Malabar", "paratha malabar", "5 pcs", 9.0],
  ["Samosa Potato", "samosa potato", "12 pcs", 10.0],
  ["Spring Rolls", "spring rolls", "12 pcs", 12.0],
  ["Kibbeh", "kibbeh", "12 pcs", 15.0],
  ["Falafel", "falafel", "12 pcs", 8.0],
  ["Shawarma Chicken", "shawarma chicken", "500g", 18.0],
  ["Shawarma Meat", "shawarma meat", "500g", 22.0],
]);

const FROZEN = [
  ["Ice Cream Vanilla Tub", "آيس cream vanilla", "1.5L", 18.0, "pcs"],
  ["Ice Cream Chocolate Tub", "آيس cream chocolate", "1.5L", 18.0, "pcs"],
  ["Ice Cream Mango Tub", "آيس cream mango", "1.5L", 20.0, "pcs"],
  ["Ice Cream Pistachio Tub", "آيس cream pistachio", "1L", 22.0, "pcs"],
  ["Ice Cream Cone Vanilla", "آيس cream cone", "4 pcs", 8.0, "box"],
  ["Ice Cream Bar Magnum", "magnum", "3 pcs", 15.0, "box"],
  ["Ice Cream Cornetto", "cornetto", "4 pcs", 12.0, "box"],
];
for (const [en, ar, size, price, unit] of FROZEN) {
  add(`${en} ${size}`, `${ar} ${size}`, "Frozen Foods", unit, price);
}

// ── Fresh Produce ─────────────────────────────────────────────
const PRODUCE = [
  ["Tomato", "طماطم", "1kg", 5.0, "kg"],
  ["Cucumber", "خيار", "1kg", 4.0, "kg"],
  ["Onion White", "بصل أبيض", "1kg", 3.0, "kg"],
  ["Onion Red", "بصل أحمر", "1kg", 4.0, "kg"],
  ["Potato", "بطاطس", "1kg", 3.5, "kg"],
  ["Carrot", "جزر", "1kg", 4.0, "kg"],
  ["Bell Pepper Green", "فلفل أخضر", "1kg", 8.0, "kg"],
  ["Bell Pepper Red", "فلفل أحمر", "1kg", 10.0, "kg"],
  ["Eggplant", "باذنجان", "1kg", 6.0, "kg"],
  ["Zucchini", "كوسa", "1kg", 6.0, "kg"],
  ["Cabbage", "ملفوف", "1 pcs", 4.0, "pcs"],
  ["Lettuce", "خس", "1 pcs", 3.0, "pcs"],
  ["Spinach", "سبانخ", "1 bundle", 3.0, "bundle"],
  ["Coriander Fresh", "كزبرة طازجة", "1 bundle", 2.0, "bundle"],
  ["Parsley Fresh", "بقدونس", "1 bundle", 2.0, "bundle"],
  ["Mint Fresh", "نعnaع طازج", "1 bundle", 2.0, "bundle"],
  ["Garlic", "ثوم", "250g", 5.0, "pkt"],
  ["Ginger Fresh", "زنجبيل", "250g", 6.0, "pkt"],
  ["Lemon", "ليمون", "1kg", 5.0, "kg"],
  ["Orange", "برتقال", "1kg", 6.0, "kg"],
  ["Apple Red", "تفاح أحمر", "1kg", 8.0, "kg"],
  ["Apple Green", "تفاح أخضر", "1kg", 8.0, "kg"],
  ["Banana", "موز", "1kg", 5.0, "kg"],
  ["Grapes Green", "عنب أخضر", "1kg", 12.0, "kg"],
  ["Grapes Red", "عنب أحمر", "1kg", 14.0, "kg"],
  ["Watermelon", "بطيخ", "1 pcs", 15.0, "pcs"],
  ["Melon", "شمام", "1 pcs", 12.0, "pcs"],
  ["Pomegranate", "رمان", "1kg", 15.0, "kg"],
  ["Mango", "مانgo", "1kg", 12.0, "kg"],
  ["Pineapple", "أnanas", "1 pcs", 10.0, "pcs"],
  ["Avocado", "أvocado", "1 pcs", 5.0, "pcs"],
  ["Kiwi", "kiwi", "1kg", 18.0, "kg"],
  ["Strawberry", "فراولة", "250g", 12.0, "pkt"],
  ["Blueberry", "blueberry", "125g", 15.0, "pkt"],
];
for (const [en, ar, size, price, unit] of PRODUCE) {
  add(`${en} ${size}`, `${ar} ${size}`, "Fresh Produce", unit, price);
}

// ── Personal Care ─────────────────────────────────────────────
brandItems("Dove", "dove", "Personal Care", "pcs", [
  ["Soap Bar", "صابon", "135g", 5.0],
  ["Body Wash", "body wash", "500ml", 22.0],
  ["Shampoo", "shampoo", "400ml", 25.0],
  ["Conditioner", "conditioner", "400ml", 25.0],
  ["Deodorant", "deodorant", "150ml", 18.0],
]);
brandItems("Nivea", "nivea", "Personal Care", "pcs", [
  ["Cream Blue", "cream blue", "150ml", 15.0],
  ["Body Lotion", "body lotion", "400ml", 25.0],
  ["Deodorant Roll On", "deodorant", "50ml", 12.0],
  ["Lip Balm", "lip balm", "4.8g", 10.0],
  ["Men Shaving Foam", "shaving foam", "200ml", 18.0],
]);
brandItems("Head & Shoulders", "head & shoulders", "Personal Care", "bottle", [
  ["Shampoo Classic", "shampoo", "400ml", 28.0],
  ["Shampoo Menthol", "shampoo menthol", "400ml", 28.0],
  ["Shampoo Smooth", "shampoo smooth", "400ml", 28.0],
]);
brandItems("Colgate", "colgate", "Personal Care", "tube", [
  ["Toothpaste Max Fresh", "معجون أسنان", "120ml", 12.0],
  ["Toothpaste Total", "معجون total", "120ml", 14.0],
  ["Toothpaste Kids", "معجون kids", "50ml", 8.0],
  ["Mouthwash", "غargle", "250ml", 15.0],
]);
brandItems("Signal", "signal", "Personal Care", "tube", [
  ["Toothpaste White", "معجون", "120ml", 8.0],
  ["Toothpaste Herbal", "معجون herbal", "120ml", 8.0],
]);
brandItems("Pantene", "pantene", "Personal Care", "bottle", [
  ["Shampoo", "shampoo", "400ml", 22.0],
  ["Conditioner", "conditioner", "360ml", 22.0],
  ["Hair Oil", "hair oil", "100ml", 18.0],
]);
brandItems("Gillette", "gillette", "Personal Care", "pcs", [
  ["Razor Blue 2", "razor", "2 pcs", 8.0],
  ["Razor Mach3", "mach3", "1 pcs", 35.0],
  ["Shaving Gel", "shaving gel", "200ml", 22.0],
  ["Foam Sensitive", "foam", "200ml", 18.0],
]);

const PERSONAL = [
  ["Toothbrush Soft", "فرشاة أسنان soft", "1 pcs", 5.0, "pcs"],
  ["Toothbrush Medium", "فرشاة أسنان medium", "1 pcs", 5.0, "pcs"],
  ["Dental Floss", "dental floss", "50m", 8.0, "pcs"],
  ["Cotton Buds", "cotton buds", "200 pcs", 6.0, "box"],
  ["Cotton Pads", "cotton pads", "80 pcs", 8.0, "pkt"],
  ["Sanitary Pads Regular", "فوط صحية", "10 pcs", 12.0, "pkt"],
  ["Sanitary Pads Night", "فوط ليلية", "8 pcs", 14.0, "pkt"],
  ["Baby Diapers Size 3", "حفاضات size 3", "44 pcs", 55.0, "pkt"],
  ["Baby Diapers Size 4", "حفاضات size 4", "40 pcs", 55.0, "pkt"],
  ["Baby Diapers Size 5", "حفاضات size 5", "36 pcs", 55.0, "pkt"],
  ["Baby Wipes", "مناديل baby", "80 pcs", 12.0, "pkt"],
  ["Shampoo Anti Dandruff", "shampoo anti dandruff", "400ml", 20.0, "bottle"],
  ["Hair Gel", "gel شعر", "250ml", 12.0, "jar"],
  ["Hair Spray", "hair spray", "250ml", 15.0, "bottle"],
  ["Face Wash", "face wash", "150ml", 18.0, "tube"],
  ["Body Soap Antibacterial", "صابon antibacterial", "125g", 4.0, "pcs"],
  ["Hand Sanitizer", "معقم يد", "500ml", 12.0, "bottle"],
  ["Sunscreen SPF 50", "sunscreen", "100ml", 35.0, "tube"],
  ["Vaseline Petroleum", "vaseline", "100ml", 10.0, "jar"],
  ["Aloe Vera Gel", "aloe vera", "200ml", 15.0, "tube"],
  ["Comb", "مشط", "1 pcs", 3.0, "pcs"],
  ["Hair Brush", "فرشaة شعر", "1 pcs", 8.0, "pcs"],
  ["Nail Clipper", "مقص أظافر", "1 pcs", 5.0, "pcs"],
  ["Razor Disposable 5pk", "razor disposable", "5 pcs", 10.0, "pkt"],
  ["Shower Cap", "shower cap", "1 pcs", 3.0, "pcs"],
];
for (const [en, ar, size, price, unit] of PERSONAL) {
  add(`${en} ${size}`, `${ar} ${size}`, "Personal Care", unit, price);
}

// ── Household & Cleaning ──────────────────────────────────────
brandItems("Persil", "persil", "Household & Cleaning", "pkt", [
  ["Detergent Powder", "مسحوق غسيل", "3kg", 35.0],
  ["Detergent Powder", "مسحوق غسيل", "6kg", 60.0],
  ["Detergent Liquid", "سائل غسيل", "2.5L", 40.0],
  ["Fabric Softener", "منعم", "2L", 25.0],
]);
brandItems("Tide", "tide", "Household & Cleaning", "pkt", [
  ["Detergent Powder", "مسحوق", "3kg", 38.0],
  ["Detergent Liquid", "سائل", "2.5L", 42.0],
  ["Pods", "pods", "15 pcs", 35.0],
]);
brandItems("Ariel", "ariel", "Household & Cleaning", "pkt", [
  ["Detergent Powder", "مسحوق", "3kg", 36.0],
  ["Detergent Liquid", "سائل", "2.5L", 40.0],
  ["Pods", "pods", "12 pcs", 30.0],
]);
brandItems("Fairy", "fairy", "Household & Cleaning", "bottle", [
  ["Dishwashing Liquid", "سائل جلي", "1L", 12.0],
  ["Dishwashing Liquid Lemon", "سائل lemon", "1L", 12.0],
  ["Dishwashing Liquid Apple", "سائل apple", "1L", 12.0],
]);
brandItems("Pril", "pril", "Household & Cleaning", "bottle", [
  ["Dishwashing Liquid", "سائل جلي", "1L", 10.0],
  ["Dishwashing Liquid Lemon", "سائل lemon", "1L", 10.0],
]);
brandItems("Clorox", "clorox", "Household & Cleaning", "bottle", [
  ["Bleach", "كلorox", "3.78L", 15.0],
  ["Bleach", "كلorox", "1.89L", 10.0],
  ["Toilet Cleaner", "منظف مرحاض", "750ml", 12.0],
  ["Multi Surface", "multi surface", "750ml", 14.0],
]);
brandItems("Dettol", "dettol", "Household & Cleaning", "bottle", [
  ["Antiseptic", "معقم", "750ml", 22.0],
  ["Antiseptic", "معقم", "1L", 28.0],
  ["Hand Wash", "hand wash", "200ml", 12.0],
  ["Surface Cleaner", "surface cleaner", "750ml", 15.0],
]);
brandItems("Fine", "fine", "Household & Cleaning", "roll", [
  ["Tissue Toilet Roll", "منadil wc", "12 rolls", 18.0],
  ["Tissue Toilet Roll", "منadil wc", "24 rolls", 32.0],
  ["Facial Tissue Box", "منadil وجه", "200 sheets", 8.0],
  ["Kitchen Towel", "kitchen towel", "2 rolls", 12.0],
  ["Wet Wipes", "wet wipes", "80 pcs", 10.0],
]);
brandItems("Pampers", "pampers", "Household & Cleaning", "pkt", [
  ["Baby Diapers Size 1", "حفاضات 1", "44 pcs", 50.0],
  ["Baby Diapers Size 2", "حفاضات 2", "44 pcs", 52.0],
  ["Baby Wipes Sensitive", "wipes sensitive", "64 pcs", 14.0],
]);

const HOUSEHOLD = [
  ["Trash Bags Large", "أكياس نفايات", "30 pcs", 12.0, "roll"],
  ["Trash Bags Medium", "أكياس medium", "30 pcs", 10.0, "roll"],
  ["Aluminum Foil", "ورق أluminum", "30m", 12.0, "roll"],
  ["Cling Film", "ناylon", "30m", 8.0, "roll"],
  ["Baking Paper", "baking paper", "20 sheets", 8.0, "roll"],
  ["Sponge Scrub", "sponge", "3 pcs", 5.0, "pkt"],
  ["Steel Wool", "steel wool", "6 pcs", 4.0, "pkt"],
  ["Floor Cleaner Pine", "منظف أرضيات", "1.5L", 15.0, "bottle"],
  ["Floor Cleaner Lavender", "منظف lavender", "1.5L", 15.0, "bottle"],
  ["Glass Cleaner", "glass cleaner", "750ml", 10.0, "bottle"],
  ["Air Freshener Spray", "معطر", "300ml", 12.0, "can"],
  ["Air Freshener Gel", "معطر gel", "150g", 8.0, "jar"],
  ["Insect Spray", "رsh insect", "400ml", 15.0, "can"],
  ["Moth Balls", "moth balls", "100g", 6.0, "pkt"],
  ["Matches Box", "عود ثقاب", "10 boxes", 5.0, "box"],
  ["Lighter Disposable", "ولاعة", "1 pcs", 2.0, "pcs"],
  ["Charcoal BBQ", "فحم", "3kg", 15.0, "bag"],
  ["Fire Starter", "fire starter", "24 cubes", 8.0, "box"],
  ["Battery AA 4pk", "بطاريات AA", "4 pcs", 8.0, "pkt"],
  ["Battery AAA 4pk", "بطاريات AAA", "4 pcs", 8.0, "pkt"],
  ["Light Bulb LED 9W", "لمبة LED", "1 pcs", 8.0, "pcs"],
  ["Extension Cord 3m", "موصل كهrb", "1 pcs", 25.0, "pcs"],
  ["Duct Tape", "شريط لاصق", "1 roll", 6.0, "roll"],
  ["Super Glue", "super glue", "1 pcs", 4.0, "pcs"],
  ["Plastic Cups 50pk", "أكواب plastic", "50 pcs", 8.0, "pkt"],
  ["Plastic Plates 25pk", "أطباق plastic", "25 pcs", 10.0, "pkt"],
  ["Paper Plates 25pk", "أطباق paper", "25 pcs", 8.0, "pkt"],
  ["Garbage Bin 30L", "سلة نفايات", "1 pcs", 35.0, "pcs"],
  ["Mop Stick", "ممسحة", "1 pcs", 25.0, "pcs"],
  ["Broom", "مكنسة", "1 pcs", 20.0, "pcs"],
];
for (const [en, ar, size, price, unit] of HOUSEHOLD) {
  add(`${en} ${size}`, `${ar} ${size}`, "Household & Cleaning", unit, price);
}

// ── Baby Care ─────────────────────────────────────────────────
brandItems("Johnson's", "johnson's", "Baby Care", "bottle", [
  ["Baby Shampoo", "shampoo baby", "200ml", 18.0],
  ["Baby Oil", "زيت baby", "200ml", 15.0],
  ["Baby Lotion", "lotion baby", "200ml", 18.0],
  ["Baby Powder", "powder baby", "200g", 12.0],
  ["Baby Soap", "صابon baby", "125g", 8.0],
  ["Baby Wipes", "wipes baby", "72 pcs", 14.0],
]);
brandItems("Huggies", "huggies", "Baby Care", "pkt", [
  ["Diapers Size 3", "حفاضات 3", "44 pcs", 58.0],
  ["Diapers Size 4", "حفاضات 4", "40 pcs", 58.0],
  ["Diapers Size 5", "حفاضات 5", "36 pcs", 58.0],
  ["Pull Ups Size 4", "pull ups 4", "22 pcs", 45.0],
]);

const BABY = [
  ["Baby Formula Stage 1", "حليب أطفال 1", "400g", 45.0, "can"],
  ["Baby Formula Stage 2", "حليب أطفال 2", "400g", 45.0, "can"],
  ["Baby Formula Stage 3", "حليب أطفال 3", "400g", 42.0, "can"],
  ["Baby Cereal Rice", "cereal rice", "200g", 15.0, "box"],
  ["Baby Cereal Wheat", "cereal wheat", "200g", 15.0, "box"],
  ["Baby Biscuits", "biscuits baby", "150g", 10.0, "pkt"],
  ["Baby Bottle 250ml", "bottle baby", "250ml", 25.0, "pcs"],
  ["Pacifier", "لهاية", "1 pcs", 12.0, "pcs"],
  ["Baby Nail Scissors", "مقص أظافر baby", "1 pcs", 10.0, "pcs"],
  ["Baby Thermometer", "thermometer", "1 pcs", 35.0, "pcs"],
];
for (const [en, ar, size, price, unit] of BABY) {
  add(`${en} ${size}`, `${ar} ${size}`, "Baby Care", unit, price);
}

// ── Expand to ~1000 with size/variant duplicates ──────────────
const EXPANSION_TEMPLATES = [
  ["Instant Noodles Chicken", "نoodles chicken", "Snacks & Confectionery", "pkt", 2.0],
  ["Instant Noodles Beef", "نoodles beef", "Snacks & Confectionery", "pkt", 2.0],
  ["Instant Noodles Vegetable", "نoodles veg", "Snacks & Confectionering", "pkt", 2.0],
  ["Cup Noodles Chicken", "cup noodles", "Snacks & Confectionery", "cup", 4.0],
  ["Cup Noodles Spicy", "cup noodles spicy", "Snacks & Confectionery", "cup", 4.0],
];

const NOODLE_BRANDS = ["Indomie", "Maggi", "Nissin", "Samyang", "Knorr"];
for (const brand of NOODLE_BRANDS) {
  for (let i = 1; i <= 8; i++) {
    add(
      `${brand} Instant Noodles Flavor ${i}`,
      `${brand} نoodles ${i}`,
      "Snacks & Confectionery",
      "pkt",
      2 + (i % 3)
    );
  }
}

const SAUCE_BRANDS = ["Heinz", "Goody", "American Garden", "Maggi", "Knorr"];
const SAUCE_TYPES = ["Hot", "Garlic", "Soy", "Teriyaki", "Chili Garlic", "BBQ", "Ranch", "Caesar"];
for (const brand of SAUCE_BRANDS) {
  for (const type of SAUCE_TYPES) {
    add(`${brand} ${type} Sauce 400g`, `${brand} ${type} صلصة`, "Canned & Preserved", "bottle", 8 + Math.random() * 6);
  }
}

const JUICE_BRANDS = ["Al Rabie", "Sun Top", "Capri Sun", "Rani", "Tropicana", "Minute Maid"];
const JUICE_FLAVORS = ["Orange", "Apple", "Mango", "Grape", "Mixed Fruit", "Pineapple", "Pomegranate", "Peach"];
for (const brand of JUICE_BRANDS) {
  for (const flavor of JUICE_FLAVORS) {
    add(`${brand} ${flavor} Juice 1L`, `${brand} ${flavor} عصير`, "Beverages", "L", 6 + Math.random() * 5);
    add(`${brand} ${flavor} Juice 200ml`, `${brand} ${flavor} عصير`, "Beverages", "pcs", 1.5 + Math.random() * 2);
  }
}

const CANDY_TYPES = ["Gummy Bears", "Lollipops", "Chewing Gum", "Mints", "Hard Candy", "Jelly", "Marshmallow", "Toffee"];
const CANDY_BRANDS = ["Haribo", "Chupa Chups", "Extra", "Mentos", "Alpenliebe", "Halls", "Trolli", "Fruittella"];
for (const brand of CANDY_BRANDS) {
  for (const type of CANDY_TYPES) {
    add(`${brand} ${type}`, `${brand} ${type}`, "Snacks & Confectionery", "pkt", 2 + Math.random() * 4);
  }
}

const CLEANING_BRANDS = ["DAC", "Mr Muscle", "Vanish", "Harpic", "Jif", "Ajax", "Pledge", "Glade"];
const CLEANING_TYPES = ["Bathroom", "Kitchen", "Floor", "Glass", "Drain", "Oven", "Furniture", "Carpet"];
for (const brand of CLEANING_BRANDS) {
  for (const type of CLEANING_TYPES) {
    add(`${brand} ${type} Cleaner 750ml`, `${brand} ${type} منظف`, "Household & Cleaning", "bottle", 10 + Math.random() * 8);
  }
}

const SHAMPOO_BRANDS = ["Clear", "Sunsilk", "Herbal Essences", "Tresemme", "L'Oreal", "Garnier", "Vatika", "Dabur"];
const SHAMPOO_TYPES = ["Anti Dandruff", "Smooth", "Volume", "Repair", "Color", "Keratin", "Argan", "Coconut"];
for (const brand of SHAMPOO_BRANDS) {
  for (const type of SHAMPOO_TYPES) {
    add(`${brand} ${type} Shampoo 400ml`, `${brand} ${type} شامبو`, "Personal Care", "bottle", 15 + Math.random() * 15);
    add(`${brand} ${type} Conditioner 360ml`, `${brand} ${type} بلسم`, "Personal Care", "bottle", 15 + Math.random() * 15);
  }
}

const RICE_BRANDS = ["Abu Kass", "Sunwhite", "Tilda", "Royal", "India Gate", "Al Wadi", "Sera", "Mahmood"];
const RICE_TYPES = ["Basmati", "Calrose", "Jasmine", "Sushi", "Brown", "Wild", "Parboiled", "Premium"];
const RICE_SIZES = ["1kg", "2kg", "5kg", "10kg"];
for (const brand of RICE_BRANDS) {
  for (const type of RICE_TYPES) {
    for (const size of RICE_SIZES) {
      const base = size === "1kg" ? 10 : size === "2kg" ? 18 : size === "5kg" ? 40 : 75;
      add(`${brand} ${type} Rice ${size}`, `${brand} ${type} أرز`, "Rice & Grains", size.includes("kg") ? "sack" : "pkt", base);
    }
  }
}

// Dedupe by English name
const seen = new Set();
const unique = [];
for (const p of PRODUCTS) {
  const key = p.en.toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(p);
}

// Trim or pad to ~1000
const TARGET = 1000;
let catalog = unique.slice(0, TARGET);
let counter = catalog.length + 1;
while (catalog.length < TARGET) {
  const base = catalog[counter % catalog.length];
  catalog.push({
    ...base,
    en: `${base.en} (Alt ${counter})`,
    ar: `${base.ar} (بديل ${counter})`,
    price: base.price,
  });
  counter++;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const rows = catalog.map((p, i) => {
  const sku = `BQ-${String(i + 1).padStart(4, "0")}-${slugify(p.en).slice(0, 20)}`;
  return [
    p.en,
    p.ar,
    sku,
    "", // barcode — fill from supplier or Open Food Facts
    p.category,
    p.unit,
    "",
    p.cost.toFixed(2),
    p.price.toFixed(2),
    "0",
    "5",
    "yes",
  ];
});

mkdirSync(OUT_DIR, { recursive: true });

const csvLines = [
  HEADERS.join(","),
  ...rows.map((row) =>
    row.map((cell) => {
      const s = String(cell);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  ),
];
const csvPath = join(OUT_DIR, "baqala-products-1000.csv");
writeFileSync(csvPath, "\uFEFF" + csvLines.join("\n"), "utf8");

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
XLSX.utils.book_append_sheet(wb, ws, "Products");
const xlsxPath = join(OUT_DIR, "baqala-products-1000.xlsx");
XLSX.writeFile(wb, xlsxPath);

console.log(`Generated ${catalog.length} products`);
console.log(`CSV:  ${csvPath}`);
console.log(`XLSX: ${xlsxPath}`);
