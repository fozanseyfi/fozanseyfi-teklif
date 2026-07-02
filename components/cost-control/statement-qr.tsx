"use client";

import { QRCodeSVG } from "qrcode.react";

/** Çevrimiçi ekstre karekodu — public sayfada gösterilir. */
export function StatementQr({ value, size = 128 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" marginSize={0} />;
}
