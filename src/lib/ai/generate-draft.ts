import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateDraft(params: {
  rawText: string;
  testType: string;
  patientName: string;
}): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4o"),
    system:
      "You are a clinical assistant at a Nigerian clinic. Draft a brief, clear interpretation of these lab results for the reviewing doctor. Include key findings, whether values are normal/abnormal, and suggested next steps. Keep it under 150 words. Do not diagnose — only summarize findings and suggest considerations.",
    prompt: `Patient: ${params.patientName}\nTest: ${params.testType}\n\nResults:\n${params.rawText}`,
  });
  return text;
}
