import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/ahp/[section]">) {
  const { section } = await params;
  return renderSection("ahp", section);
}
