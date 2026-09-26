import { Fragment } from "react";

import { cn } from "@/lib/utils";

const LABELLED = /^(Domain|Aspek|Indikator|Definisi operasional|Bukti minimum|Bukti penguat|Batas bahan|Ringkasan penelitian|Kontak|Tata kelola data): (.*)$/;
const URL_SPLIT = /(https:\/\/[^\s]+)/;

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(URL_SPLIT).map((part, i) =>
        part.startsWith("https://") ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all underline underline-offset-2">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

// Renders instrument text exactly as authored: paragraphs at blank lines,
// "Label: value" lines as a definition list. No wording is changed.
export function RichHelpText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={cn("flex flex-col gap-3 text-sm leading-relaxed", className)}>
      {text.split("\n\n").map((block, b) => {
        const lines = block.split("\n");
        const labelled = lines.map((l) => LABELLED.exec(l));
        if (labelled.every(Boolean)) {
          return (
            <dl key={b} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[10rem_1fr]">
              {labelled.map((m, i) => (
                <Fragment key={i}>
                  <dt className="font-medium text-foreground">{m![1]}</dt>
                  <dd className="text-muted-foreground">
                    <Linkified text={m![2]} />
                  </dd>
                </Fragment>
              ))}
            </dl>
          );
        }
        return (
          <p key={b} className="whitespace-pre-line">
            <Linkified text={block} />
          </p>
        );
      })}
    </div>
  );
}
