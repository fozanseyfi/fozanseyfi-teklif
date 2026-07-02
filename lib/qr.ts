import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";
import { QRCodeSVG } from "qrcode.react";

/**
 * Verilen metni (URL) QR kodu SVG string'ine çevirir. Tarayıcı tarafında
 * (client) kullanılır — PDF/print HTML'ine gömülebilsin diye statik SVG üretir.
 */
export function qrSvgMarkup(value: string, size = 108): string {
  if (!value) return "";
  return renderToStaticMarkup(
    createElement(QRCodeSVG, { value, size, level: "M", marginSize: 0 }),
  );
}
