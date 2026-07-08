/**
 * Görüntü netleştirme — tarayıcıda (AI bulut modeli DEĞİL): 2× büyütme (yüksek
 * kaliteli örnekleme) + keskinleştirme (unsharp benzeri 3×3) + hafif kontrast/
 * doygunluk. Kırpılan uydu altlığındaki çatı çizgilerini izlemeyi kolaylaştırır.
 */
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new window.Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

/** Yerinde 3×3 keskinleştirme (k = miktar). */
function sharpen(id: ImageData, k: number): void {
  const data = id.data, w = id.width, h = id.height;
  const orig = new Uint8ClampedArray(data);
  const center = 1 + 4 * k;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        data[i + c] = center * orig[i + c] - k * (orig[i - 4 + c] + orig[i + 4 + c] + orig[i - w * 4 + c] + orig[i + w * 4 + c]);
      }
    }
  }
}

export interface EnhanceResult {
  dataUrl: string;
  ms: number;
  scale: number; // uygulanan büyütme (piksel katsayısı)
}

export async function enhanceImage(dataUrl: string): Promise<EnhanceResult> {
  const t0 = performance.now();
  const img = await loadImg(dataUrl);
  const W = img.width, H = img.height;
  const maxDim = 2600;
  let scale = 2;
  if (W * scale > maxDim || H * scale > maxDim) scale = Math.max(1, Math.min(maxDim / W, maxDim / H));
  const sw = Math.max(1, Math.round(W * scale)), sh = Math.max(1, Math.round(H * scale));

  const c = document.createElement("canvas");
  c.width = sw; c.height = sh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { dataUrl, ms: 0, scale: 1 };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, sw, sh);
  const id = ctx.getImageData(0, 0, sw, sh);
  sharpen(id, 0.55);
  ctx.putImageData(id, 0, 0);

  // Hafif kontrast/doygunluk (ayrı canvas'ta filtre ile)
  const out = document.createElement("canvas");
  out.width = sw; out.height = sh;
  const octx = out.getContext("2d");
  if (octx) { octx.filter = "contrast(1.08) saturate(1.12) brightness(1.02)"; octx.drawImage(c, 0, 0); }

  const finalUrl = (octx ? out : c).toDataURL("image/jpeg", 0.92);
  return { dataUrl: finalUrl, ms: Math.round(performance.now() - t0), scale };
}
