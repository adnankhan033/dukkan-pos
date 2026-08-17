import html2canvas from "html2canvas";

export const REPORT_COVER_WIDTH_PX = 1122;

/**
 * Render a fixed-width cover HTML fragment to canvas without extra blank height.
 */
export async function renderReportCoverToCanvas(coverHtml, selector) {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-12000px;top:0;z-index:-1;background:#fff;direction:ltr;overflow:hidden;";
  host.innerHTML = coverHtml;
  document.body.appendChild(host);

  try {
    const coverEl = host.querySelector(selector);
    if (!coverEl) {
      throw new Error(`Cover element "${selector}" not found`);
    }

    coverEl.style.width = `${REPORT_COVER_WIDTH_PX}px`;
    coverEl.style.height = "auto";
    coverEl.style.overflow = "hidden";

    const height = Math.max(Math.ceil(coverEl.getBoundingClientRect().height), 1);
    const width = REPORT_COVER_WIDTH_PX;

    return await html2canvas(coverEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    document.body.removeChild(host);
  }
}

export function addCoverPageToPdf(doc, coverCanvas, pageWidth, pageHeight, footerHeightMm = 10) {
  const coverImg = coverCanvas.toDataURL("image/png");
  const usableHeight = pageHeight - footerHeightMm - 4;
  let drawWidth = pageWidth;
  let drawHeight = (coverCanvas.height * drawWidth) / coverCanvas.width;

  if (drawHeight > usableHeight) {
    drawHeight = usableHeight;
    drawWidth = (coverCanvas.width * drawHeight) / coverCanvas.height;
  }

  const offsetX = (pageWidth - drawWidth) / 2;
  const offsetY = Math.max(2, (usableHeight - drawHeight) / 2);
  doc.addImage(coverImg, "PNG", offsetX, offsetY, drawWidth, drawHeight);
}
