import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/settings/[section]">) {
  const { section } = await params;
  return renderSection("settings", section);
}
