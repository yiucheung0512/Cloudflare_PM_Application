import type { CloudflareBindings, ClassificationResult } from "./types";

const CLASSIFIER_MODEL = "@cf/meta/llama-3.1-8b-instruct";

console.log("✓ ai.ts loaded");

export async function classifyFeedback(text: string, env: CloudflareBindings): Promise<ClassificationResult> {
  console.log("🤖 [AI-CLASSIFY] Starting classification for:", text.slice(0, 50));
  
  const prompt = {
    messages: [
      { role: "system", content: "Classify feedback. Return compact JSON with keys: tag (one of: Bug Report, Feature Request, Urgent, Praise, Security, Performance, Other), sentiment (float -1..1), urgency (0..1), summary (<=20 words)." },
      { role: "user", content: text }
    ],
    max_tokens: 200,
  };

  try {
    console.log("🤖 [AI-CLASSIFY] Calling AI model...");
    const ai = await env.AI.run(CLASSIFIER_MODEL, prompt);
    const raw = ai.response ?? ai;
    console.log("🤖 [AI-CLASSIFY] Raw response:", raw);
    
    let parsed: any = null;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      console.log("🤖 [AI-CLASSIFY] Parsed:", parsed);
    } catch (err) {
      console.warn("⚠️ [AI-CLASSIFY] Parse error:", err, "Raw:", raw);
    }

    const tag = normalizeTag(parsed?.tag);
    const sentiment = clampNumber(parsed?.sentiment, -1, 1, 0);
    const urgency = clampNumber(parsed?.urgency ?? parsed?.urgency_score, 0, 1, 0.2);
    const summary = typeof parsed?.summary === "string" ? parsed.summary.slice(0, 140) : null;

    const result = { tag, sentiment, urgency, summary: summary || "" };
    console.log("✅ [AI-CLASSIFY] Result:", result);
    
    return result;
  } catch (err) {
    console.error("❌ [AI-CLASSIFY] Exception:", err);
    throw err;
  }
}

function normalizeTag(input: any): string {
  const normalized = (input || "").toString().toLowerCase();
  if (normalized.includes("urgent")) return "Urgent";
  if (normalized.includes("feature")) return "Feature Request";
  if (normalized.includes("bug")) return "Bug Report";
  if (normalized.includes("praise") || normalized.includes("love")) return "Praise";
  if (normalized.includes("security") || normalized.includes("auth") || normalized.includes("vulnerability")) return "Security";
  if (normalized.includes("performance") || normalized.includes("slow") || normalized.includes("timeout")) return "Performance";
  return "Other";
}

function clampNumber(value: any, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (Number.isFinite(num)) return Math.min(max, Math.max(min, num));
  return fallback;
}

export async function generateDailySummary(feedbackList: any[], date: string, env: CloudflareBindings): Promise<string> {
  console.log(`🤖 [AI-DAILY-SUMMARY] Generating summary for ${date} with ${feedbackList.length} items`);
  
  if (feedbackList.length === 0) {
    return `No feedback received on ${date}.`;
  }

  const feedbackTexts = feedbackList.map((f, i) => `${i + 1}. [${f.tag || 'Unknown'}] ${f.text}`).join('\n');
  
  const prompt = {
    messages: [
      { 
        role: "system", 
        content: "You are a product analyst. Summarize the day's feedback in 2-3 concise paragraphs. Highlight key themes, sentiment trends, urgent issues, and actionable insights. Be specific and data-driven." 
      },
      { 
        role: "user", 
        content: `Feedback received on ${date}:\n\n${feedbackTexts}\n\nProvide a comprehensive daily summary.` 
      }
    ],
    max_tokens: 500,
  };

  try {
    console.log("🤖 [AI-DAILY-SUMMARY] Calling AI model...");
    const ai = await env.AI.run(CLASSIFIER_MODEL, prompt);
    const summary = ai.response ?? ai;
    console.log("✅ [AI-DAILY-SUMMARY] Generated summary:", typeof summary === 'string' ? summary.slice(0, 100) : summary);
    return typeof summary === "string" ? summary : JSON.stringify(summary);
  } catch (err) {
    console.error("❌ [AI-DAILY-SUMMARY] Exception:", err);
    return `Error generating summary: ${err}`;
  }
}
