import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export interface DraftResult {
  summary: string;
  recommendations: string;
  suggestedMedication: {
    drugName: string;
    dosage: string;
    quantity: string;
    instructions: string;
  } | null;
}

export async function generateDraft(params: {
  rawText: string;
  testType: string;
  patientName: string;
}): Promise<DraftResult> {
  const { text } = await generateText({
    model: anthropic("claude-opus-4-20250514"),
    system: "You are a clinical assistant at a Nigerian clinic. Analyze lab results and return ONLY a valid JSON object (no markdown, no code fences) with this exact structure: { \"summary\": \"brief interpretation under 100 words\", \"recommendations\": \"numbered list of next steps\", \"suggestedMedication\": { \"drugName\": \"...\", \"dosage\": \"...\", \"quantity\": \"...\", \"instructions\": \"...\" } or null if no medication needed }. Do not diagnose. Only summarize findings and suggest considerations.",
    prompt: `Patient: ${params.patientName}\nTest: ${params.testType}\n\nResults:\n${params.rawText}`,
  });

  try {
    return JSON.parse(text) as DraftResult;
  } catch {
    // Fallback if AI doesn't return valid JSON
    return {
      summary: text,
      recommendations: "",
      suggestedMedication: null,
    };
  }
}

export function serializeDraft(draft: DraftResult): string {
  return JSON.stringify(draft);
}

export function parseDraftText(raw: string | null | undefined): DraftResult | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DraftResult>;
    return {
      summary: parsed.summary ?? "",
      recommendations: parsed.recommendations ?? "",
      suggestedMedication: parsed.suggestedMedication ?? null,
    };
  } catch {
    return {
      summary: raw,
      recommendations: "",
      suggestedMedication: null,
    };
  }
}
