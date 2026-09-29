import { callText, type CallLog, type CallTarget } from "./call";
import { GATEWAY_ENV_KEY, GATEWAY_PROVIDER_KEY } from "./models";
import { REPORT_CHAPTER_NARRATE, REPORT_SYSTEM } from "./prompts/report";

export function reportTarget(modelId: string): CallTarget {
  return { providerKey: GATEWAY_PROVIDER_KEY, modelId, envKeyName: GATEWAY_ENV_KEY, baseUrl: null, temperature: 0.3 };
}

export async function narrateChapter(modelId: string, chapterTitle: string, facts: string): Promise<{ text: string; log: CallLog }> {
  return callText({
    target: reportTarget(modelId),
    prompt: REPORT_CHAPTER_NARRATE,
    system: REPORT_SYSTEM,
    text: REPORT_CHAPTER_NARRATE.render({ chapterTitle, facts }),
    maxOutputTokens: 1600,
    mock: () =>
      `[MOCK] Bab "${chapterTitle}" merangkum keluaran simulasi dry-run DCGMI, bukan hasil penelitian. Narasi ini dibuat oleh model tiruan (MOCK_AI=1) dari ${facts.length.toLocaleString("id-ID")} karakter fakta terstruktur; angka lengkap tersedia pada tabel dan grafik di bawah.\n\n[MOCK] Dengan model nyata (${modelId}) paragraf ini menjelaskan angka kunci, komponen bermasalah beserta alasannya, dan status gate bab ini.`,
  });
}
