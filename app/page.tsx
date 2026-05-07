import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// SaaS landing yerine: oturum acmis kullanici dashboard'a, diger herkes
// dogrudan login sayfasina dusurulur. 4 site arasinda paylasilan auth
// nedeniyle Karardestek'te login olan kullanici bu siteye geldiginde de
// otomatik olarak dashboard'a gecer.
export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
