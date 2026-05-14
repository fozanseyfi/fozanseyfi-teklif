import { requireAuth } from "@/lib/auth";
import { ProjectImportClient } from "./client";

export default async function ProjectImportPage() {
  await requireAuth();
  return <ProjectImportClient />;
}
