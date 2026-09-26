import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/fgd/[section]">) {
  const { section } = await params;
  return renderSection("fgd", section);
}
