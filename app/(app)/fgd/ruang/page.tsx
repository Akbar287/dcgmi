import { renderSection } from "../../_sections/render";

// The static "ruang" folder (for the room route) shadows [section]; render the section here.
export default async function Page() {
  return renderSection("fgd", "ruang");
}
