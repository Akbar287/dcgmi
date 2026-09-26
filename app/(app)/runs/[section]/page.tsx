import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/runs/[section]">) {
  const { section } = await params;
  return renderSection("runs", section);
}
