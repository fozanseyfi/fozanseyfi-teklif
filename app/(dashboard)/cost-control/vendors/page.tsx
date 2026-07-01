import { redirect } from "next/navigation";

// Tedarikçiler artık üst seviye /suppliers sekmesinde. Eski link/bookmark'lar
// için yönlendir.
export default function LegacyVendorsRedirect() {
  redirect("/suppliers");
}
