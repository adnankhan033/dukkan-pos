#!/usr/bin/env python3
"""Extract CATAF auto-parts stock PDF into Nexttel POS product import CSV/XLSX."""

from __future__ import annotations

import csv
import re
import zlib
from collections import defaultdict
from pathlib import Path

PDF_PATH = Path(
    "/Users/sharedtechadnan/Documents/family documents/Abdul aziz/grp brand ord desc non zero 20-8-2026.pdf"
)
OUT_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = OUT_DIR / "auto-parts-cataf-import.csv"
XLSX_PATH = OUT_DIR / "auto-parts-cataf-import.xlsx"

HEADERS = [
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
]

SKIP_ROW_TEXT = {
    "sr#",
    "item part number",
    "item description",
    "stock",
    "avg cost",
    "valuation",
    "brand",
    "printed on",
    "page",
    "email",
    "web",
    "mobile",
    "fax",
    "phone",
}


def load_pdf() -> bytes:
    return PDF_PATH.read_bytes()


def get_stream(pdf: bytes, num: int) -> bytes | None:
    pat = re.compile(
        rb"(?:^|\n)" + str(num).encode() + rb" 0 obj\s*<<(.*?)>>\s*stream\n",
        re.S,
    )
    m = pat.search(pdf)
    if not m:
        return None
    header = m.group(1)
    length = int(re.search(rb"/Length\s+(\d+)", header).group(1))
    data = pdf[m.end() : m.end() + length]
    if b"FlateDecode" in header:
        data = zlib.decompress(data)
    return data


def parse_tounicode(data: bytes) -> dict[int, str]:
    s = data.decode("latin-1")
    cmap: dict[int, str] = {}
    for a, b, dest in re.findall(
        r"<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>", s
    ):
        start, end, uni = int(a, 16), int(b, 16), int(dest, 16)
        for i, code in enumerate(range(start, end + 1)):
            cmap[code] = chr(uni + i)
    return cmap


def decode_pdf_string(raw: str, cmap: dict[int, str]) -> str:
    """Decode a PDF literal string (without outer parens) through ToUnicode.

    Escaped characters like \\( still represent that byte and must go through cmap.
    """
    out: list[str] = []
    i = 0
    while i < len(raw):
        ch = raw[i]
        if ch == "\\" and i + 1 < len(raw):
            nxt = raw[i + 1]
            if nxt in "nrtbf()\\":
                code = {
                    "n": 10,
                    "r": 13,
                    "t": 9,
                    "b": 8,
                    "f": 12,
                    "(": 0x28,
                    ")": 0x29,
                    "\\": 0x5C,
                }[nxt]
                out.append(cmap.get(code, chr(code)))
                i += 2
                continue
            octal = ""
            j = i + 1
            while j < len(raw) and raw[j] in "01234567" and len(octal) < 3:
                octal += raw[j]
                j += 1
            if octal:
                code = int(octal, 8)
                out.append(cmap.get(code, chr(code)))
                i = j
                continue
            i += 2
            continue
        out.append(cmap.get(ord(ch), ch))
        i += 1
    return "".join(out)


def tokenize(s: str) -> list[tuple]:
    tokens: list[tuple] = []
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if c.isspace():
            i += 1
            continue
        if c == "(":
            j = i + 1
            buf: list[str] = []
            while j < n:
                if s[j] == "\\" and j + 1 < n:
                    buf.append(s[j : j + 2])
                    j += 2
                    continue
                if s[j] == ")":
                    break
                buf.append(s[j])
                j += 1
            tokens.append(("str", "".join(buf)))
            i = j + 1
            continue
        if c == "[":
            j = i + 1
            depth = 1
            while j < n and depth:
                if s[j] == "\\":
                    j += 2
                    continue
                if s[j] == "(":
                    # skip string so nested ] doesn't confuse
                    j += 1
                    while j < n:
                        if s[j] == "\\" and j + 1 < n:
                            j += 2
                            continue
                        if s[j] == ")":
                            j += 1
                            break
                        j += 1
                    continue
                if s[j] == "[":
                    depth += 1
                elif s[j] == "]":
                    depth -= 1
                j += 1
            tokens.append(("array", s[i:j]))
            i = j
            continue
        if c == "/":
            j = i + 1
            while j < n and not s[j].isspace() and s[j] not in "[]()<>{}/%":
                j += 1
            tokens.append(("name", s[i + 1 : j]))
            i = j
            continue
        j = i
        while j < n and not s[j].isspace() and s[j] not in "[]()<>{}/%":
            j += 1
        tok = s[i:j]
        i = j
        try:
            tokens.append(("num", float(tok)))
        except ValueError:
            tokens.append(("op", tok))
    return tokens


def decode_tj_array(arr: str, cmap: dict[int, str]) -> str:
    parts: list[str] = []
    k = 1
    while k < len(arr) - 1:
        if arr[k] == "(":
            j = k + 1
            buf: list[str] = []
            while j < len(arr) - 1:
                if arr[j] == "\\" and j + 1 < len(arr):
                    buf.append(arr[j : j + 2])
                    j += 2
                    continue
                if arr[j] == ")":
                    break
                buf.append(arr[j])
                j += 1
            parts.append(decode_pdf_string("".join(buf), cmap))
            k = j + 1
        else:
            k += 1
    return "".join(parts)


def extract_page(stream_bytes: bytes, fonts: dict[str, dict[int, str]]) -> list[tuple]:
    s = stream_bytes.decode("latin-1")
    tokens = tokenize(s)
    items: list[tuple[float, float, str]] = []
    font = "a"
    x = 0.0
    y = 0.0
    stack: list[tuple] = []
    for t in tokens:
        kind = t[0]
        if kind in ("num", "name", "str", "array"):
            stack.append(t)
            continue
        op = t[1]
        cmap = fonts.get(font, fonts["a"])
        if op == "Tf":
            if len(stack) >= 2 and stack[-2][0] == "name":
                font = stack[-2][1]
            stack = []
        elif op == "Tm":
            if len(stack) >= 6 and stack[-2][0] == "num" and stack[-1][0] == "num":
                x = stack[-2][1]
                y = stack[-1][1]
            stack = []
        elif op in ("Td", "TD"):
            if len(stack) >= 2 and stack[-2][0] == "num" and stack[-1][0] == "num":
                x += stack[-2][1]
                y += stack[-1][1]
            stack = []
        elif op == "Tj":
            if stack and stack[-1][0] == "str":
                text = decode_pdf_string(stack[-1][1], cmap)
                if text.strip():
                    items.append((y, x, text))
            stack = []
        elif op == "'":
            if stack and stack[-1][0] == "str":
                text = decode_pdf_string(stack[-1][1], cmap)
                if text.strip():
                    items.append((y, x, text))
            stack = []
        elif op == "TJ":
            if stack and stack[-1][0] == "array":
                text = decode_tj_array(stack[-1][1], cmap)
                if text.strip():
                    items.append((y, x, text))
            stack = []
        else:
            stack = []
    return items


def column_for(x: float) -> str:
    if x < 700:
        return "sr"
    if x < 2800:
        return "part"
    if x < 8400:
        return "desc"
    if x < 9450:
        return "stock"
    if x < 10370:
        return "cost"
    return "value"


def parse_number(text: str) -> float | None:
    cleaned = text.replace(",", "").replace(" ", "").strip()
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def clean_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_headerish(text: str) -> bool:
    t = text.lower().strip()
    if not t:
        return True
    if t.startswith("page ") or t.startswith("printed"):
        return True
    for skip in SKIP_ROW_TEXT:
        if t == skip or t.startswith(skip):
            return True
    if "@" in t or t.startswith("http") or t.startswith("www"):
        return True
    if re.fullmatch(r"\d{1,2}-[A-Za-z]{3}-\d{4}", t):
        return True
    return False


def merge_same_xy(items: list[tuple[float, float, str]]) -> list[tuple[float, float, str]]:
    """Font-subset glyphs are drawn at the same x,y; concatenate in stream order."""
    grouped: dict[tuple[int, int], list[str]] = {}
    order: list[tuple[int, int]] = []
    for y, x, text in items:
        key = (round(y), round(x))
        if key not in grouped:
            grouped[key] = []
            order.append(key)
        grouped[key].append(text)
    out = []
    for key in order:
        y, x = key
        out.append((float(y), float(x), "".join(grouped[key])))
    return out


NOISE_RE = re.compile(
    r"(Email:|Web\s*:|Mobile:|Fax:|Ph:|cataf721@gmail\.com|03\d{8,}"
    r"|W-\s*SALE.*|COMMANDO AUTO|DIR LOWER.*|BOOT/\s*DISC PAD"
    r"|Printed On:|Page \d+ of \d+|Date As On|Stock Valuation"
    r"|Showing Stock|As On|http|www\.)",
    re.I,
)


def strip_noise(text: str) -> str:
    text = NOISE_RE.sub(" ", text)
    return clean_spaces(text)


def parse_stock(text: str) -> int | None:
    text = strip_noise(text)
    nums = re.findall(r"\d[\d,]*", text)
    if not nums:
        return None
    # Prefer the last isolated integer (letterhead numbers come first)
    for raw in reversed(nums):
        n = parse_number(raw)
        if n is None:
            continue
        n = int(round(n))
        if 0 < n < 100000:
            return n
    return None


def rows_from_items(items: list[tuple[float, float, str]]) -> list[dict]:
    """Cluster glyphs into rows by sequential Y proximity."""
    items = merge_same_xy(items)
    ordered = sorted(items, key=lambda t: (t[0], t[1]))
    clusters: list[list[tuple[float, float, str]]] = []
    for y, x, text in ordered:
        if clusters and abs(y - clusters[-1][0][0]) <= 18:
            clusters[-1].append((y, x, text))
        else:
            clusters.append([(y, x, text)])

    rows = []
    for cluster in clusters:
        cells: dict[str, list[str]] = defaultdict(list)
        for _y, x, text in sorted(cluster, key=lambda t: t[1]):
            cells[column_for(x)].append(text)
        merged = {k: clean_spaces(" ".join(v)) for k, v in cells.items()}
        rows.append(merged)
    return rows


def looks_like_brand_header(row: dict) -> str | None:
    sr = (row.get("sr") or "").strip()
    part = (row.get("part") or "").strip()
    if sr.lower() != "brand":
        return None
    if row.get("stock") or row.get("cost"):
        return None
    name = re.sub(r"\bBrand\b", "", part, flags=re.I).strip()
    return name or "Unbranded"


def extract_products(pdf: bytes) -> list[dict]:
    fonts = {
        "9": parse_tounicode(get_stream(pdf, 75)),
        "a": parse_tounicode(get_stream(pdf, 93)),
        "b": parse_tounicode(get_stream(pdf, 87)),
        "c": parse_tounicode(get_stream(pdf, 81)),
    }
    page_contents = [5, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69]
    products = []
    current_brand = "Unbranded"
    for page_no, obj in enumerate(page_contents, 1):
        data = get_stream(pdf, obj)
        items = extract_page(data, fonts)
        for row in rows_from_items(items):
            brand = looks_like_brand_header(row)
            if brand:
                current_brand = brand
                continue
            part = strip_noise(row.get("part") or "")
            desc = strip_noise(row.get("desc") or "")
            sr = strip_noise(row.get("sr") or "")
            if not part or part.lower() in SKIP_ROW_TEXT or desc.lower() in SKIP_ROW_TEXT:
                continue
            if is_headerish(part) or is_headerish(sr):
                continue
            sr_num = parse_number(sr)
            if sr_num is None or not (1 <= sr_num <= 999) or not float(sr_num).is_integer():
                continue
            stock = parse_stock(row.get("stock") or "")
            cost = parse_number(strip_noise(row.get("cost") or ""))
            if stock is None:
                continue
            if part.upper() == "SHOP SETTING":
                continue
            products.append(
                {
                    "brand": current_brand,
                    "part": part,
                    "desc": desc,
                    "stock": stock,
                    "cost": cost if cost is not None else 0.0,
                    "page": page_no,
                }
            )
    return products


def unique_sku(part: str, brand: str, used: dict[str, int]) -> str:
    base = re.sub(r"\s+", "-", part.strip())[:40] or "PART"
    key = base.upper()
    if key not in used:
        used[key] = 1
        return base
    used[key] += 1
    suffix = re.sub(r"[^A-Za-z0-9]+", "", brand)[:8] or str(used[key])
    sku = f"{base}-{suffix}"
    n = 2
    while sku.upper() in used:
        sku = f"{base}-{suffix}-{n}"
        n += 1
    used[sku.upper()] = 1
    return sku


def product_name(part: str, desc: str) -> str:
    part = part.strip()
    desc = desc.strip()
    if not desc or desc.upper() == part.upper() or desc.upper() in part.upper():
        return part
    if part.upper() in desc.upper():
        return desc
    return f"{part} {desc}"


def to_import_rows(products: list[dict]) -> list[list[str]]:
    used: dict[str, int] = {}
    rows = []
    for p in products:
        sku = unique_sku(p["part"], p["brand"], used)
        name = product_name(p["part"], p["desc"])
        cost = f"{p['cost']:.2f}"
        rows.append(
            [
                name,
                "",
                sku,
                "",
                p["brand"],
                "pcs",
                "",
                cost,
                cost,  # no retail price in PDF — copy avg cost
                "default",
                str(p["stock"]),
                "0",
                "yes",
            ]
        )
    return rows


def main() -> None:
    pdf = load_pdf()
    products = extract_products(pdf)
    rows = to_import_rows(products)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with CSV_PATH.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(HEADERS)
        writer.writerows(rows)

    print(f"Extracted {len(products)} products")
    brands: dict[str, int] = {}
    for p in products:
        brands[p["brand"]] = brands.get(p["brand"], 0) + 1
    for brand, count in brands.items():
        print(f"  {count:3d}  {brand}")
    print("\nSample rows:")
    for p in products[:25]:
        print(
            f"  [{p['brand']}] {p['part']!r} | {p['desc']!r} | qty={p['stock']} cost={p['cost']}"
        )
    print(f"\nCSV: {CSV_PATH}")


if __name__ == "__main__":
    main()
