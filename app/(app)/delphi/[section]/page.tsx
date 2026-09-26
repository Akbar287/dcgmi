import { renderSection } from "../../_sections/render";

export default async function Page({ params }: PageProps<"/delphi/[section]">) {
  const { section } = await params;
  return renderSection("delphi", section);
}
