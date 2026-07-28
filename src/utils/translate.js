/** Translate English text to Arabic (requires internet). Never blocks product save. */
export async function translateToArabic(text) {
  const trimmed = text?.trim();
  if (!trimmed) {
    throw new Error("Enter an English name first");
  }

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(trimmed)}&langpair=en|ar`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error("Translation unavailable. Check internet or type Arabic manually.");
  }

  const data = await response.json();
  const translated = data?.responseData?.translatedText?.trim();

  if (!translated) {
    throw new Error("No translation returned. Type Arabic manually.");
  }

  // MyMemory sometimes returns ALL CAPS or the same text for brand names
  if (translated.toUpperCase() === trimmed.toUpperCase() && !/[\u0600-\u06FF]/.test(translated)) {
    throw new Error("Could not translate this name. Type Arabic manually.");
  }

  return translated;
}
