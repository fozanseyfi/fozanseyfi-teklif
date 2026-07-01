import { listCostProjects, listImportableQuotes } from "@/app/actions/cost-control";
import { CostListClient } from "@/components/cost-control/cost-list-client";

export const dynamic = "force-dynamic";

export default async function CostControlPage() {
  const [projects, importable] = await Promise.all([listCostProjects(), listImportableQuotes()]);
  return <CostListClient projects={projects} importable={importable} />;
}
