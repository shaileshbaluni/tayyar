import { generatePdfBlob } from "./pdf-export";
import { pdfjsLib } from "./pdfjs-setup";
import { sanitizeResume } from "./store";

function baseFilename(resume) {
  const safe = sanitizeResume(resume ?? {});
  const n = (safe.data?.basics?.name || "resume").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  return n || "resume";
}

/**
 * Renders the resume PDF to a single canvas (pages stacked) and downloads PNG or JPEG.
 */
export async function downloadResumeRaster(resume, format = "png") {
  const mime = format === "jpeg" ? "image/jpeg" : "image/png";
  const ext = format === "jpeg" ? "jpg" : "png";
  const quality = format === "jpeg" ? 0.9 : undefined;

  const pdfBlob = await generatePdfBlob(resume);
  const buf = await pdfBlob.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const numPages = doc.numPages;

  let scale = 1.75;
  const pages = [];
  let maxW = 0;
  let totalH = 0;
  const gap = 16;

  for (let attempt = 0; attempt < 2; attempt++) {
    pages.length = 0;
    maxW = 0;
    totalH = 0;
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = viewport.width;
      c.height = viewport.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport }).promise;
      pages.push({ canvas: c, w: viewport.width, h: viewport.height });
      maxW = Math.max(maxW, viewport.width);
      totalH += viewport.height;
    }
    totalH += gap * Math.max(0, numPages - 1);
    if (totalH <= 12000 || attempt === 1) break;
    scale = 1.15;
  }

  const out = document.createElement("canvas");
  out.width = maxW;
  out.height = totalH;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  let y = 0;
  for (let i = 0; i < pages.length; i++) {
    const { canvas, w, h } = pages[i];
    const x = (maxW - w) / 2;
    ctx.drawImage(canvas, x, y);
    y += h + (i < pages.length - 1 ? gap : 0);
  }

  const name = `${baseFilename(resume)}.${ext}`;
  await new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not create image blob"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      },
      mime,
      quality
    );
  });
}
