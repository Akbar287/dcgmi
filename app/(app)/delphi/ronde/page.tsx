import { renderSection } from "../../_sections/render";

// The static "ronde" folder (for the round room) shadows [section]; render the section here.
export default async function Page() {
  return renderSection("delphi", "ronde");
}
