import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/panel/[section]">) {
  const { section } = await params;
  return renderSection("panel", section);
}
