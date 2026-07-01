import { listCostProjects, listImportableQuotes, listUpcomingCollections } from "@/app/actions/cost-control";
import { CostListClient } from "@/components/cost-control/cost-list-client";

export const dynamic = "force-dynamic";

export default async function CostControlPage() {
  const [projects, importable, upcoming] = await Promise.all([
    listCostProjects(),
    listImportableQuotes(),
    listUpcomingCollections(),
  ]);
  return <CostListClient projects={projects} importable={importable} upcoming={upcoming} />;
}
