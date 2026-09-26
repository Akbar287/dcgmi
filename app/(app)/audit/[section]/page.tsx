import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/audit/[section]">) {
  const { section } = await params;
  return renderSection("audit", section);
}
