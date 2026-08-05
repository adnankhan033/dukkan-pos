export function downloadBlob(blob, filename) {
  if (!blob) {
    throw new Error("Nothing to download — file could not be created.");
  }
  if (blob.size <= 0) {
    throw new Error("Download failed — generated file is empty.");
  }
  if (!filename?.trim()) {
    throw new Error("Download failed — missing file name.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return { filename, size: blob.size };
}

export function downloadText(content, filename, mimeType = "text/csv;charset=utf-8") {
  if (content == null || content === "") {
    throw new Error("Nothing to download — template content is empty.");
  }
  const blob = new Blob([content], { type: mimeType });
  return downloadBlob(blob, filename);
}

export function downloadArrayBuffer(buffer, filename, mimeType) {
  if (!buffer || buffer.byteLength <= 0) {
    throw new Error("Nothing to download — file buffer is empty.");
  }
  const blob = new Blob([buffer], { type: mimeType });
  return downloadBlob(blob, filename);
}

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

export function fileTypeLabel(filename) {
  const name = String(filename || "").toLowerCase();
  if (name.endsWith(".xlsx")) return "Excel workbook";
  if (name.endsWith(".csv")) return "CSV spreadsheet";
  return "File";
}
