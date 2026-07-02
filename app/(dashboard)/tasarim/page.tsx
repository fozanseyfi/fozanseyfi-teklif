import { requireAuth } from "@/lib/auth";
import { DesignApp } from "@/components/solar-design/design-app";

export const dynamic = "force-dynamic";

export default async function TasarimPage() {
  await requireAuth();
  return <DesignApp />;
}
