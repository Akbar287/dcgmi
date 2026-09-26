import { renderSection } from "../../_sections/render";

// The static "asesmen" folder (for the assessment room) shadows [section]; render the section here.
export default async function Page() {
  return renderSection("scoring", "asesmen");
}
