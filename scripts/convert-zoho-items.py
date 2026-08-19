#!/usr/bin/env python3
"""Convert Zoho Inventory Item.csv to NexttelPOS product import format."""
import csv
import re
import sys
from pathlib import Path

try:
    import openpyxl
except ImportError:
    openpyxl = None

HEADERS = [
    "name", "name_ar", "sku", "barcode", "category", "unit", "supplier",
    "cost_price", "selling_price", "quantity", "min_stock", "published",
]

ARABIC_RE = re.compile(r"[\u0600-\u06FF]")
SIZE_RE = re.compile(
    r"(\d+(?:\.\d+)?)\s*(مل|ml|ML|م\s*ل|لتر|ل\b|L\b|lt|LT|جم|ج\b|g\b|G\b|gram|grams|kg|KG|ك\b|كجم|كيلو|gr\b)",
    re.IGNORECASE,
)

BRANDS = [
    ("المراعي", "Almarai"), ("مراعي", "Almarai"), ("نادك", "Nadec"), ("الربيع", "Al Rabie"),
    ("السعودية", "Saudia"), ("بوك", "Puck"), ("ليز", "Lays"), ("lays", "Lays"),
    ("بيبسي", "Pepsi"), ("pepsi", "Pepsi"), ("كوكا", "Coca-Cola"), ("coca", "Coca-Cola"),
    ("سفن", "7UP"), ("7up", "7UP"), ("الوطنية", "Al Watania"), ("امريكانا", "Americana"),
    ("سادia", "Sadia"), ("سadia", "Sadia"), ("الكabeer", "Al Kabeer"), ("الكبير", "Al Kabeer"),
    ("قودي", "Goody"), ("goody", "Goody"), ("هينز", "Heinz"), ("heinz", "Heinz"),
    ("نescafe", "Nescafe"), ("نسكafe", "Nescafe"), ("نستle", "Nestle"), ("نestle", "Nestle"),
    ("بامperz", "Pampers"), ("بامبرز", "Pampers"), ("pampers", "Pampers"), ("ديتol", "Dettol"),
    ("ديتول", "Dettol"), ("dettol", "Dettol"), ("كلorox", "Clorox"), ("كلورox", "Clorox"),
    ("فairy", "Fairy"), ("فairi", "Fairy"), ("برingles", "Pringles"), ("برينgles", "Pringles"),
    ("برينجيلز", "Pringles"), ("تويكس", "Twix"), ("twix", "Twix"), ("سnickers", "Snickers"),
    ("galaxy", "Galaxy"), ("جalaxy", "Galaxy"), ("جالكسي", "Galaxy"), ("كitkat", "KitKat"),
    ("كadbury", "Cadbury"), ("جillette", "Gillette"), ("جillette", "Gillette"), ("ماك", "Gillette"),
    ("colgate", "Colgate"), ("كolgate", "Colgate"), ("signal", "Signal"), ("dove", "Dove"),
    ("nivea", "Nivea"), ("fa ", "Fa "), ("فا ", "Fa "), ("لوكس", "Lux"), ("lux", "Lux"),
    ("johnson", "Johnson's"), ("جونسن", "Johnson's"), ("persil", "Persil"), ("tide", "Tide"),
    ("ariel", "Ariel"), ("fine", "Fine"), ("فine", "Fine"), ("nova", "Nova"), ("nova", "Nova"),
    ("aquafina", "Aquafina"), ("lipton", "Lipton"), ("rabea", "Rabea"), ("العمeed", "Al Ameed"),
    ("العميد", "Al Ameed"), ("العلali", "Al Alali"), ("العلali", "Al Alali"), ("العلali", "Al Alali"),
    ("العلali", "Al Alali"), ("العلالي", "Al Alali"), ("ابu kass", "Abu Kass"), ("ابو كass", "Abu Kass"),
    ("افia", "Afia"), ("افيا", "Afia"), ("حyat", "Hayat"), ("حيات", "Hayat"), ("barilla", "Barilla"),
    ("maggi", "Maggi"), ("maggi", "Maggi"), ("knorr", "Knorr"), ("indomie", "Indomie"),
    ("oreo", "Oreo"), ("nutella", "Nutella"), ("nutella", "Nutella"), ("lotus", "Lotus"),
    ("لوتس", "Lotus"), ("red bull", "Red Bull"), ("ريd bull", "Red Bull"), ("sting", "Sting"),
    ("almarai", "Almarai"), ("al rabie", "Al Rabie"), ("كودريت", "Codiet"),
    ("الويز", "Always"), ("always", "Always"), ("باتكس", "Pattex"), ("pattex", "Pattex"),
    ("جرينز", "Greens"), ("greens", "Greens"), ("ابار حائل", "Abar Hail"), ("بوك", "Puck"),
    ("فا ", "Fa "), ("fa ", "Fa "), ("لوكس", "Lux"), ("فيري", "Fairy"), ("fairy", "Fairy"),
    ("دافيدوف", "Davidoff"), ("davidoff", "Davidoff"), ("لوزين", "Loacker"), ("loacker", "Loacker"),
    ("النخبة", "Al Nokhba"), ("غندور", "Ghandour"), ("المزرعة", "Al Mazraa"), ("النورس", "Al Nours"),
    ("فستa", "Fiesta"), ("فستa", "Fiesta"), ("اوريجنال", "Original"), ("اوريغo", "Origo"),
    ("لوبo", "Lobo"), ("سلطan", "Sultan"), ("سلطan", "Sultan"), ("سلطan", "Sultan"),
]

TERM_EN = [
    ("حليب", "Milk"), ("لبن", "Laban"), ("جبن", "Cheese"), ("جبنة", "Cheese"), ("زبادي", "Yogurt"),
    ("زبدة", "Butter"), ("سمن", "Ghee"), ("بيض", "Eggs"), ("مياه", "Water"), ("ماء", "Water"),
    ("عصير", "Juice"), ("شاي", "Tea"), ("قهوة", "Coffee"), ("مشروب", "Drink"), ("كولا", "Cola"),
    ("بسكويت", "Biscuits"), ("شوكolat", "Chocolate"), ("شokolat", "Chocolate"), ("شوكلاتة", "Chocolate"),
    ("شokolat", "Chocolate"), ("حلاوة", "Halawa"), ("حلاوه", "Halawa"), ("علكة", "Chewing Gum"),
    ("لبان", "Chewing Gum"), ("شips", "Chips"), ("شيبس", "Chips"), ("تونة", "Tuna"), ("تونه", "Tuna"),
    ("معجون", "Paste"), ("كاتشup", "Ketchup"), ("كاتشب", "Ketchup"), ("مايونيز", "Mayonnaise"),
    ("صلصة", "Sauce"), ("زيت", "Oil"), ("أرز", "Rice"), ("ارز", "Rice"), ("دقيق", "Flour"),
    ("سكر", "Sugar"), ("ملح", "Salt"), ("بهارات", "Spices"), ("فلفل", "Pepper"), ("كمون", "Cumin"),
    ("خبز", "Bread"), ("كيك", "Cake"), ("دجاج", "Chicken"), ("لحم", "Meat"), ("مفروم", "Mince"),
    ("صابون", "Soap"), ("شامبو", "Shampoo"), ("معجون اسنان", "Toothpaste"), ("معجون أسنان", "Toothpaste"),
    ("فرشaة", "Toothbrush"), ("فرشة", "Toothbrush"), ("حفاض", "Diapers"), ("حفائظ", "Diapers"),
    ("فوط", "Pads"), ("صحية", "Sanitary"), ("مناديل", "Tissue"), ("ورق", "Paper"), ("منظف", "Cleaner"),
    ("مسحوق", "Detergent"), ("غسيل", "Laundry"), ("بطاريات", "Batteries"), ("بطارية", "Battery"),
    ("لمبة", "Bulb"), ("ولاعة", "Lighter"), ("فحم", "Charcoal"), ("مخلل", "Pickles"), ("فول", "Fava Beans"),
    ("حمص", "Chickpeas"), ("تمر", "Dates"), ("لوz", "Almonds"), ("لوز", "Almonds"), ("فستق", "Pistachio"),
    ("شمر", "Fennel"), ("بخور", "Incense"), ("قفازات", "Gloves"), ("مكينة", "Razor"), ("حلاقة", "Shaving"),
    ("ادوات", "Supplies"), ("مدرسية", "School"), ("قرطاسية", "Stationery"), ("صبغة", "Hair Dye"),
    ("شعر", "Hair"), ("معقم", "Antiseptic"), ("مطهر", "Disinfectant"), ("بطاطس", "Potatoes"),
    ("طماطم", "Tomato"), ("بصل", "Onion"), ("خيار", "Cucumber"), ("موز", "Banana"), ("تفاح", "Apple"),
    ("برتقال", "Orange"), ("بندق", "Hazelnut"), ("فراولة", "Strawberry"), ("مانgo", "Mango"), ("مانجو", "Mango"),
    ("بepper", "Pepper"), ("ماhoلبية", "Pudding"), ("مهلبية", "Pudding"), ("قشطة", "Cream"), ("كريمة", "Cream"),
    ("مفرش", "Table Cover"), ("لاصق", "Tape"), ("سكين", "Knife"), ("مكعبات", "Cubes"), ("مرق", "Stock"),
]

TERM_AR = [
    ("milk", "حليب"), ("water", "مياه"), ("juice", "عصير"), ("tea", "شاي"), ("coffee", "قهوة"),
    ("ketchup", "كاتشب"), ("chocolate", "شوكолاتة"), ("biscuit", "بسكويت"), ("soap", "صابون"),
    ("shampoo", "شامبو"), ("toothpaste", "معجون أسنان"), ("tissue", "مناديل"), ("oil", "زيت"),
    ("rice", "أرز"), ("flour", "دقيق"), ("sugar", "سugar"), ("cheese", "جبن"), ("bread", "خبز"),
    ("chicken", "دجاج"), ("tuna", "تونة"), ("cola", "كولا"), ("chips", "شips"), ("lays", "ليز"),
    ("battery", "بطاريات"), ("diaper", "حفاضات"), ("sanitary", "فوط صحية"),
]

CATEGORY_RULES = [
    ("Dairy & Eggs", ["حليب", "لبن", "جبن", "جبنة", "زبادي", "زبدة", "سمن", "بيض", "milk", "laban", "cheese", "yogurt", "butter", "ghee", "egg", "قشطة", "مهلبية"]),
    ("Beverages", ["مياه", "مياة", "ماء", "عصير", "شاي", "قهوة", "مشروb", "مشروب", "كولا", "pepsi", "cola", "juice", "water", "tea", "coffee", "drink", "nescafe", "lipton", "energy", "سفن", "mirinda", "fanta", "sprite", "barbican", "moussy", "كركديه", "كركدية", "تمر هندي", "ابار", "حائل", "اوريجن", "اوريغo", "codiet", "كودريت"]),
    ("Snacks & Confectionery", ["lays", "ليز", "شips", "شيبس", "بسكويت", "شokolat", "شوكolat", "شوكلات", "حلاو", "علكة", "لبان", "twix", "تويكس", "snickers", "galaxy", "kitkat", "oreo", "nutella", "lotus", "ويفر", "كaramell", "candy", "gum", "chocolate", "biscuit", "cracker", "chips", "pringles", "doritos", "cheetos", "popcorn", "halawa", "dates", "تمر", "لوz", "لوز", "فستق", "كaju", "nuts", "معmoul", "معمول"]),
    ("Rice & Grains", ["أرز", "ارز", "rice", "دقيق", "flour", "سكر", "sugar", "ملح", "salt", "عدس", "lentil", "حمص", "chickpea", "فول", "fava", "مكرونة", "pasta", "spaghetti", "macaroni", "شofan", "oats", "cereal", "semolina", "برghul", "bulgur", "freekeh", "فرick", "baking powder", "بaking", "خميرة"]),
    ("Oils & Ghee", ["زيت", " oil", "oil ", "سمن", "ghee", "زيتون", "olive"]),
    ("Canned & Preserved", ["تونة", "تونه", "tuna", "معجون", "paste", "كاتchup", "ketchup", "ماyo", "mayonnaise", "صلص", "sauce", "مخلل", "pickle", "زيتون", "olive", "فول", "مدms", "مدمس", "chickpea", "corn", "ذرة", "peas", "بازilla", "canned", "معلب"]),
    ("Spices & Seasonings", ["بهار", "spice", "فلفل", "pepper", "cumin", "كمون", "كركم", "turmeric", "قرفة", "cinnamon", "هيل", "cardamom", "قرنفل", "clove", "شmer", "شمر", "fennel", "curry", "kabsa", "mandi", "biryani", "bouillon", "مرق"]),
    ("Bread & Bakery", ["خبz", "خبز", "bread", "كيك", "cake", "كroissant", "كرواس", "toast", "توست", "معmoul", "معمول", "pizza", "بيتza", "بيتza", "بيتza", "بيتza", "بيتza", "بيتza", "بيتza", "بيتزا", "muffin", "danish", "فطائر", "سambousek", "سمبوس", "fatayer", "فطاير"]),
    ("Frozen Foods", ["مجمد", "frozen", "nugget", "ناget", "nuggets", "strips", "برger", "burger", "بطاطس", "fries", "فرايز", "paratha", "برatha", "samosa", "سمبوس", "spring roll", "kibbeh", "كibbeh", "falafel", "فalafel", "shawarma", "شawarma", "آيس", "ice cream", "magnum", "cornetto"]),
    ("Fresh Produce", ["طماطم", "tomato", "بصل", "onion", "خيار", "cucumber", "بطاطس", "potato", "جزر", "carrot", "فلفل", "lettuce", "خس", "سبانخ", "spinach", "موز", "banana", "تفاح", "apple", "برتقال", "orange", "عنب", "grape", "باذنجان", "eggplant", "كوسa", "zucchini", "رمان", "pomegranate", "مانgo", "مانجو", "fresh", "طازج"]),
    ("Personal Care", ["صابون", "soap", "شامبو", "shampoo", "conditioner", "بلسم", "معجون", "toothpaste", "فرشaة", "فرشة", "toothbrush", "deodorant", "مزil", "حلاق", "shav", "razor", "gillette", "ماك", "dove", "nivea", "pantene", "head", "colgate", "signal", "lotion", "كريم", "cream", "sanitary", "فوط", "صحية", "حفاض", "diaper", "pampers", "بامper", "بامبر", "wipes", "منadil", "cotton", "قطن", "sunscreen", "vaseline", "فazeline", "فaseline", "صبغة", "hair dye", "gel", "جل", "perfume", "عطر", "body wash"]),
    ("Household & Cleaning", ["منظف", "cleaner", "detergent", "مسحوق", "غسيل", "persil", "tide", "ariel", "fairy", "pril", "jif", "ajax", "harpic", "clorox", "كلorox", "bleach", "dettol", "ديتol", "ديتول", "tissue", "منadil", "toilet", "حمام", "kitchen", "مطبخ", "floor", "أرض", "air freshener", "معطر", "insect", "حشر", "trash", "نفايات", "foil", "aluminum", "nylon", "cling", "sponge", "sponge", "matches", "ثقاب", "lighter", "ولاعة", "battery", "بطاريات", "bulb", "لمبة", "extension", "موصل", "tape", "لاصق", "broom", "مكنسة", "mop", "ممسحة", "charcoal", "فحم", "incense", "بخور", "plastic cup", "أكواب", "plate", "أطباق", "foster", "فوستر", "clarks", "كلarks"]),
    ("Baby Care", ["baby", "أطفال", "رضيع", "infant", "formula", "حليب أطفال", "johnson", "جونسن", "huggies", "هuggies"]),
    ("School & Stationery", ["مدرس", "school", "قرطاس", "stationery", "قلم", "pen", "دفتر", "notebook", "ورق a4", "a4"]),
    ("Meat & Poultry", ["دجاج", "chicken", "لحم", "meat", "beef", "مفروم", "mince", "غنm", "غنm", "غ lamb", "بقر", "lamb", "برger", "burger", "sausage", "نقanq", "نقanق", "hot dog", "هot dog", "كبda", "كبدة", "liver", "كباب", "kebab"]),
]

def has_arabic(text):
    return bool(ARABIC_RE.search(text or ""))

def normalize_ar(text):
    if not text:
        return ""
    t = text.strip()
    t = re.sub(r"\s+", " ", t)
    t = t.replace("ة ", "ة ").replace("ه ", "ة ")
    replacements = {
        "حلاوه": "حلاوة", "حلاة": "حلاوة", "تونه": "تونة", "حفائظ": "حفاضات",
        "كوديرت": "كودريت", "برينجيلز": "برينجلز", "مياة": "مياه", "مياة": "مياه",
        "ام ام": "M&M", "وردرز": "Wonder's", "باتكس": "Pattex", "الويز": "Always",
        "تيشوب": "Tichop", "مالينg": "Maling", "فيرy": "Fairy", "فيري": "Fairy",
    }
    for old, new in replacements.items():
        t = t.replace(old, new)
    return t

def parse_price(value):
    if not value:
        return 0.0
    s = str(value).replace("SAR", "").replace(",", "").strip()
    try:
        return max(0.0, float(s))
    except ValueError:
        return 0.0

def detect_unit(text):
    m = SIZE_RE.search(text or "")
    if not m:
        return "pcs"
    size, unit = m.group(1), m.group(2).lower()
    u = unit.replace(" ", "")
    if u in ("مل", "ml", "مl"):
        return "ml" if float(size) < 500 else "L"
    if u in ("لتر", "ل", "l", "lt"):
        return "L"
    if u in ("جم", "ج", "g", "gram", "grams", "gr"):
        return "g" if float(size) < 1000 else "kg"
    if u in ("kg", "ك", "كجم", "كيلo", "كilo"):
        return "kg"
    return "pcs"


def phonetic(text):
    table = str.maketrans({
        "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ب": "b", "ت": "t", "ث": "th", "ج": "j",
        "ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
        "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
        "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a",
    })
    out = text.translate(table)
    out = re.sub(r"[^a-zA-Z0-9*+\-./\s]", " ", out)
    return re.sub(r"\s+", " ", out).strip()


def is_bad_english(text):
    if not text or len(text.strip()) < 3:
        return True
    stripped = text.strip()
    if re.fullmatch(r"[\d.\s]+", stripped):
        return True
    if len(stripped.split()) == 1 and re.fullmatch(r"\d+(\.\d+)?", stripped):
        return True
    return False


def to_english(name):
    text = normalize_ar(name)
    result = text
    for ar, en in sorted(BRANDS, key=lambda x: -len(x[0])):
        result = re.sub(re.escape(ar), en, result, flags=re.IGNORECASE)
    for ar, en in sorted(TERM_EN, key=lambda x: -len(x[0])):
        result = result.replace(ar, en)
    result = re.sub(r"\s+", " ", result).strip()
    if has_arabic(result):
        latin = re.sub(r"[\u0600-\u06FF]+", " ", result)
        latin = re.sub(r"\s+", " ", latin).strip()
        result = latin if latin and not is_bad_english(latin) else phonetic(text)
    if is_bad_english(result):
        result = phonetic(text)
    return " ".join(w.capitalize() if w.islower() else w for w in result.split())

def to_arabic(name):
    text = name.strip()
    if has_arabic(text):
        return normalize_ar(text)
    result = text
    for en, ar in sorted(TERM_AR, key=lambda x: -len(x[0])):
        result = re.sub(re.escape(en), ar, result, flags=re.IGNORECASE)
    return normalize_ar(result) if has_arabic(result) or any(k in result for k in "حليبمياه") else ""

def infer_category(name_en, name_ar):
    combined = f"{name_en} {name_ar}".lower()
    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw.lower() in combined:
                return category
    return "General"

def split_names(raw, secondary):
    raw = (raw or "").strip()
    secondary = (secondary or "").strip()
    if secondary:
        if has_arabic(raw) and not has_arabic(secondary):
            return secondary, normalize_ar(raw)
        if has_arabic(secondary) and not has_arabic(raw):
            return raw, normalize_ar(secondary)
    if has_arabic(raw):
        ar = normalize_ar(raw)
        en = to_english(raw)
        return en, ar
    en = raw.title() if raw.islower() else raw
    ar = to_arabic(raw)
    return en, ar if ar else en

def convert_row(row, index):
    raw_name = row.get("Item Name", "")
    secondary = row.get("Item Name(Secondary Language)", "")
    sku = (row.get("SKU") or "").strip() or f"ITM-{index:05d}"
    selling = parse_price(row.get("Rate"))
    cost = parse_price(row.get("Purchase Rate"))
    qty = row.get("Stock On Hand") or row.get("Opening Stock") or "0"
    try:
        qty = int(float(str(qty).replace(",", "") or 0))
    except ValueError:
        qty = 0
    status = (row.get("Status") or "").strip().lower()
    published = "yes" if status == "active" else "no"

    name_en, name_ar = split_names(raw_name, secondary)
    if not name_en:
        name_en = f"Product {index}"
    category = infer_category(name_en, name_ar)
    unit = detect_unit(f"{raw_name} {secondary}")

    return [
        name_en, name_ar, sku, "", category, unit, "",
        f"{cost:.2f}", f"{selling:.2f}", str(qty), "5", published,
    ]

def main():
    src = Path("/Users/sharedtechadnan/Downloads/Item.csv")
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    csv_out = out_dir / "nexttel-import-items.csv"
    xlsx_out = out_dir / "nexttel-import-items.xlsx"

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    converted = [convert_row(r, i + 1) for i, r in enumerate(rows)]

    with csv_out.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(HEADERS)
        writer.writerows(converted)

    if openpyxl:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Products"
        ws.append(HEADERS)
        for row in converted:
            ws.append(row)
        wb.save(xlsx_out)
        print(f"XLSX: {xlsx_out}")
    else:
        print("Install openpyxl for XLSX output: pip install openpyxl")

    cats = {}
    for row in converted:
        cats[row[4]] = cats.get(row[4], 0) + 1
    print(f"Converted {len(converted)} products -> {csv_out}")
    print("Categories:", dict(sorted(cats.items(), key=lambda x: -x[1])))

if __name__ == "__main__":
    main()
