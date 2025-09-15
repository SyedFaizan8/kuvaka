import { GoogleGenAI } from "@google/genai";
import { DEFAULT_MODEL, GEMINI_API_KEY } from "./constants";


if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY must be set in environment variables");
}

// Initialize the SDK client for the Gemini Developer API (API key auth)
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

export async function callGeminiRaw(prompt: string) {
    // generateContent is the SDK wrapper for the generateContent endpoint.
    // We use the same request shape as the official quickstart: model + contents (parts -> text).
    const model = DEFAULT_MODEL;

    try {
        const resp = await ai.models.generateContent({
            model,
            contents: [
                {
                    parts: [
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
            // generationConfig: { temperature: 0.2, maxOutputTokens: 256 },
        });

        // SDK response shape mirrors the REST: resp.candidates[i].content.parts[j].text OR resp.text
        const candidate = resp?.candidates?.[0] ?? null;
        let text: string | null = null;

        if (candidate) {
            if (candidate?.content?.parts && Array.isArray(candidate.content.parts)) {
                text = candidate.content.parts.map((p: any) => p?.text ?? "").join("").trim();
            } else if (typeof candidate?.content?.text === "string") {
                text = candidate.content.text.trim();
            } else if (typeof (candidate as any)?.output === "string") {
                text = (candidate as any).output.trim();
            }
        }

        // Fallback to top-level text if present
        if (!text && typeof (resp as any)?.text === "string") {
            text = (resp as any).text.trim();
        }

        return { raw: resp, text };
    } catch (err: any) {
        // Surface helpful error info (SDK throws like any JS lib)
        // Keep message concise so callers can log full err.raw if needed.
        if (err?.response) {
            throw new Error(`Gemini SDK error ${err.response?.status}: ${JSON.stringify(err.response?.data)}`);
        }
        throw new Error(`Gemini SDK request failed: ${err?.message ?? String(err)}`);
    }
}

/** Robust parser that extracts intent label and 1-2 sentence explanation */
export function parseGeminiIntent(text: string | null) {
    if (!text) return { intent: "Medium", explanation: "No AI response; defaulted to Medium." };

    const normalized = text.replace(/\r\n/g, "\n").trim();
    const up = normalized.toUpperCase();

    // Preferred strict format: "INTENT: <High|Medium|Low>\nREASON: <...>"
    const intentMatch = normalized.match(/INTENT:\s*(HIGH|MEDIUM|LOW)/i);
    if (intentMatch) {
        const intentRaw = intentMatch[1];
        const intent = intentRaw[0].toUpperCase() + intentRaw.slice(1).toLowerCase();
        const reasonMatch = normalized.match(/REASON:\s*([\s\S]{1,500})/i);
        const explanation = reasonMatch ? reasonMatch[1].trim().split(/\n/)[0] : extractFirstSentences(normalized);
        return { intent, explanation };
    }

    // Heuristic fallbacks:
    if (up.includes("HIGH") || up.match(/\b(very interested|high intent|ready to buy|ready to evaluate|actively looking)\b/i)) {
        return { intent: "High", explanation: extractFirstSentences(normalized) };
    }
    if (up.includes("MEDIUM") || up.match(/\b(may|might|consider|interested|curious|explore)\b/i)) {
        return { intent: "Medium", explanation: extractFirstSentences(normalized) };
    }
    if (up.includes("LOW") || up.match(/\b(not interested|unlikely|low intent|no need|no budget)\b/i)) {
        return { intent: "Low", explanation: extractFirstSentences(normalized) };
    }

    // Default
    return { intent: "Medium", explanation: extractFirstSentences(normalized) };
}

function extractFirstSentences(text: string) {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return sentences.slice(0, 2).join(" ").slice(0, 500).trim();
}
