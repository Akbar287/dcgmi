import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/experts/[section]">) {
  const { section } = await params;
  return renderSection("experts", section);
}
