import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/scoring/[section]">) {
  const { section } = await params;
  return renderSection("scoring", section);
}
