const MAX_SIZE = 320;
const JPEG_QUALITY = 0.72;
const MAX_BYTES = 120000;

/** Resize/compress images before SQLite storage — large base64 blobs slow every query. */
export function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith("image/")) {
      reject(new Error("Please select an image file"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, MAX_SIZE / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        if (dataUrl.length > MAX_BYTES) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.5);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

/** Fetch a remote image URL and compress for SQLite storage. */
export async function compressImageUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download product image");
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Remote file is not an image");
  }
  const file = new File([blob], "product.jpg", { type: blob.type || "image/jpeg" });
  return compressImageFile(file);
}
