import { getNotebook } from "@/app/actions/notebook";
import { NotebookApp } from "@/components/notebook/notebook-app";

export const metadata = { title: "Not Defteri" };

export default async function NotDefteriPage() {
  const data = await getNotebook();
  return <NotebookApp initial={data} />;
}
