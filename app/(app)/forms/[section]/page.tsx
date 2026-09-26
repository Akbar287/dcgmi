import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/forms/[section]">) {
  const { section } = await params;
  return renderSection("forms", section);
}
