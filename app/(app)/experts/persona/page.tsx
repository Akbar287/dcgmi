import { renderSection } from "../../_sections/render";

// The static "persona" folder (for the editor route) shadows [section]; render the section here.
export default async function Page() {
  return renderSection("experts", "persona");
}
