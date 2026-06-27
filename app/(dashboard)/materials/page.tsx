import { listCatalogItems } from "@/app/actions/materials";
import { MaterialsClient } from "@/components/materials/materials-client";

export default async function MaterialsPage() {
  const items = await listCatalogItems();
  return <MaterialsClient initialItems={items} />;
}
