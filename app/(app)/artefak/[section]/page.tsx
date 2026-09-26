import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/artefak/[section]">) {
  const { section } = await params;
  return renderSection("artefak", section);
}
