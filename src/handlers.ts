import type { AppContext } from "./types";
import { classifyFeedback, generateDailySummary } from "./ai";
import {
  insertFeedback,
  updateFeedbackAnalysis,
  updateFeedbackStatus,
  updateFeedbackSentiment,
  updateFeedbackText,
  getAllFeedback,
  getTagCounts,
  getSentimentCounts,
  getSentimentByTier,
  getSentimentByDimension,
  getStatusTimeline,
  getUrgencyImpactData,
  getResolutionTimeByTag,
  getLatestAnalyzedFeedback,
  searchFeedback,
  getFeedbackByDate,
  getUniqueFeedbackDates,
  getCachedSummary,
  setCachedSummary,
  invalidateSummaryCache,
} from "./db";

console.log("✓ handlers.ts loaded");

// ===== POST /feedback =====
export async function handlePostFeedback(c: AppContext) {
  console.log("📨 [POST-FEEDBACK] Request received");
  
  const env = c.env;
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.feedback !== "string" || !body.feedback.trim()) {
    console.warn("⚠️ [POST-FEEDBACK] Invalid body:", body);
    return c.json({ error: "Missing 'feedback' string in body" }, 400);
  }

  const feedback = body.feedback.trim();
  const source = (body.source || "user").toString();
  const channel = (body.channel || "web").toString();
  const severityHint = body.severity_hint || null;
  const userTier = body.tier || body.user_tier || "free";

  console.log("✓ [POST-FEEDBACK] Input validated:", { source, channel, feedbackLen: feedback.length });

  try {
    // Insert
    const id = await insertFeedback(env, feedback, source, channel, severityHint, userTier);

    // Classify
    console.log("🔄 [POST-FEEDBACK] Classifying feedback...");
    let aiResult = null;
    try {
      aiResult = await classifyFeedback(feedback, env);
      console.log("✅ [POST-FEEDBACK] Classification done:", aiResult);
    } catch (err) {
      console.error("❌ [POST-FEEDBACK] Classification failed:", err);
    }

    // Update analysis
    if (aiResult) {
      await updateFeedbackAnalysis(env, id, aiResult.tag, aiResult.sentiment, aiResult.urgency, aiResult.summary);
    }

    // Invalidate cache
    await invalidateSummaryCache(env);
    console.log("✅ [POST-FEEDBACK] Response:", { id, status: "stored", analysis: aiResult ?? "pending" });

    return c.json({ id, status: "stored", analysis: aiResult ?? "pending" }, 201);
  } catch (err) {
    console.error("❌ [POST-FEEDBACK] Exception:", err);
    return c.json({ error: "Server error", detail: String(err) }, 500);
  }
}

// ===== GET /data =====
export async function handleGetData(c: AppContext) {
  console.log("📊 [GET-DATA] Request received");
  
  try {
    const rows = await getAllFeedback(c.env);
    return c.json(rows);
  } catch (err) {
    console.error("❌ [GET-DATA] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}

// ===== GET /summary =====
export async function handleGetSummary(c: AppContext) {
  console.log("📈 [GET-SUMMARY] Request received");
  const force = c.req.query("refresh") === "1";
  
  try {
    const env = c.env;

    // Check cache unless force refresh
    const cached = await getCachedSummary(env, force);
    if (cached) return c.json(cached);

    // Regenerate
    console.log("📈 [GET-SUMMARY] Regenerating...");
    const tags = await getTagCounts(env);
    const sentiment = await getSentimentCounts(env);
    const latestFeedback = await getLatestAnalyzedFeedback(env);

    // Optional AI narrative
    let narrative = null;
    try {
      console.log("💬 [GET-SUMMARY] Generating AI narrative...");
      const prompt = {
        messages: [
          { role: "system", content: "Summarize key themes from tagged feedback. Keep it short (<=120 words)." },
          { role: "user", content: JSON.stringify(latestFeedback || []) }
        ]
      };
      const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", prompt);
      narrative = ai.response ?? ai;
      console.log("✅ [GET-SUMMARY] Narrative generated");
    } catch (err) {
      console.warn("⚠️ [GET-SUMMARY] Narrative generation failed:", err);
    }

    const payload = {
      tags,
      sentiment,
      narrative,
      generated_at: new Date().toISOString(),
    };

    // Cache
    await setCachedSummary(env, payload);
    console.log("✅ [GET-SUMMARY] Response sent");
    return c.json(payload);
  } catch (err) {
    console.error("❌ [GET-SUMMARY] Exception:", err);
    return c.json({ error: "Failed to generate summary" }, 500);
  }
}

// ===== GET /search =====
export async function handleGetSearch(c: AppContext) {
  const q = (c.req.query("q") || "").trim();
  console.log("🔍 [GET-SEARCH] Query:", q);
  
  if (!q) {
    console.log("🔍 [GET-SEARCH] Empty query, returning []");
    return c.json([]);
  }

  try {
    const env = c.env;

    // Try AI Search first
    if (env.AI_SEARCH) {
      try {
        console.log("🔍 [GET-SEARCH] Using AI Search...");
        const results = await env.AI_SEARCH.query({ query: q, topK: 10 });
        console.log("✅ [GET-SEARCH] AI Search returned", results?.length || 0, "results");
        return c.json(results);
      } catch (err) {
        console.warn("⚠️ [GET-SEARCH] AI Search failed, falling back to DB");
      }
    }

    // Fallback to DB
    console.log("🔍 [GET-SEARCH] Using DB search...");
    const results = await searchFeedback(env, q);
    console.log("✅ [GET-SEARCH] DB search returned", results.length, "results");
    return c.json(results);
  } catch (err) {
    console.error("❌ [GET-SEARCH] Exception:", err);
    return c.json({ error: "Search failed" }, 500);
  }
}

// ===== PATCH /feedback/:id =====
export async function handlePatchFeedback(c: AppContext) {
  console.log("✏️ [PATCH-FEEDBACK] Request received");
  
  const env = c.env;
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json().catch(() => null);

  if (!id || isNaN(id)) {
    console.warn("⚠️ [PATCH-FEEDBACK] Invalid ID:", c.req.param("id"));
    return c.json({ error: "Invalid ID" }, 400);
  }

  if (!body) {
    console.warn("⚠️ [PATCH-FEEDBACK] Empty body");
    return c.json({ error: "Empty body" }, 400);
  }

  console.log("✓ [PATCH-FEEDBACK] Update for ID:", id, "with:", Object.keys(body));

  try {
    // Update status
    if (typeof body.status === "string") {
      await updateFeedbackStatus(env, id, body.status);
      await invalidateSummaryCache(env);
    }

    // Update sentiment
    if (typeof body.sentiment === "number") {
      await updateFeedbackSentiment(env, id, body.sentiment);
      await invalidateSummaryCache(env);
    }

    // Update tag only (without text)
    if (typeof body.tag === "string" && !body.text) {
      await env.DB.prepare(
        "UPDATE feedback SET tag = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(body.tag, id).run();
      await invalidateSummaryCache(env);
      console.log(`✅ [PATCH-FEEDBACK] Tag updated to "${body.tag}"`);
    }

    // Update text only (without changing tag)
    if (typeof body.text === "string" && body.text.trim() && !body.tag) {
      await env.DB.prepare(
        "UPDATE feedback SET text = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(body.text.trim(), id).run();
      await invalidateSummaryCache(env);
      console.log(`✅ [PATCH-FEEDBACK] Text updated`);
    }

    // Update both text and tag together
    if (typeof body.text === "string" && body.text.trim() && typeof body.tag === "string") {
      await updateFeedbackText(env, id, body.text.trim(), body.tag);
      await invalidateSummaryCache(env);
    }

    console.log("✅ [PATCH-FEEDBACK] Updated successfully");
    return c.json({ success: true });
  } catch (err) {
    console.error("❌ [PATCH-FEEDBACK] Exception:", err);
    return c.json({ error: "Update failed" }, 500);
  }
}

export async function handleDeleteFeedback(c: AppContext) {
  console.log("🗑️ [DELETE-FEEDBACK] Request received");
  
  const env = c.env;
  const id = parseInt(c.req.param("id"), 10);

  if (!id || isNaN(id)) {
    console.warn("⚠️ [DELETE-FEEDBACK] Invalid ID:", c.req.param("id"));
    return c.json({ error: "Invalid ID" }, 400);
  }

  try {
    // Delete from database
    await env.DB.prepare("DELETE FROM feedback WHERE id = ?").bind(id).run();
    
    // Invalidate cache
    await invalidateSummaryCache(env);
    
    console.log("✅ [DELETE-FEEDBACK] Deleted ID:", id);
    return c.json({ success: true, id });
  } catch (err) {
    console.error("❌ [DELETE-FEEDBACK] Exception:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
}

// ===== GET /health =====
export async function handleGetHealth(c: AppContext) {
  console.log("❤️ [HEALTH] Check");
  return c.text("ok");
}

// ===== GET /analytics/daily-summary =====
export async function handleGetDailySummary(c: AppContext) {
  const date = c.req.query("date") || new Date().toISOString().split('T')[0];
  console.log("📅 [GET-DAILY-SUMMARY] Request for date:", date);
  
  try {
    const env = c.env;
    const cacheKey = `daily_summary_${date}`;
    
    // Check cache first
    const cached = await env.KV.get(cacheKey, "text");
    if (cached) {
      console.log("✅ [GET-DAILY-SUMMARY] Returning cached summary");
      return c.json({ date, summary: cached, cached: true });
    }
    
    // Get feedback for the date
    const feedback = await getFeedbackByDate(env, date);
    
    if (feedback.length === 0) {
      console.log("⚠️ [GET-DAILY-SUMMARY] No feedback for date:", date);
      return c.json({ date, summary: `No feedback received on ${date}.`, cached: false });
    }
    
    // Generate AI summary
    const summary = await generateDailySummary(feedback, date, env);
    
    // Cache for 24 hours
    await env.KV.put(cacheKey, summary, { expirationTtl: 86400 });
    console.log("✅ [GET-DAILY-SUMMARY] Summary generated and cached");
    
    return c.json({ date, summary, cached: false, count: feedback.length });
  } catch (err) {
    console.error("❌ [GET-DAILY-SUMMARY] Exception:", err);
    return c.json({ error: "Failed to generate daily summary" }, 500);
  }
}

// ===== GET /analytics/feedback-dates =====
export async function handleGetFeedbackDates(c: AppContext) {
  console.log("📅 [GET-FEEDBACK-DATES] Request received");
  
  try {
    const dates = await getUniqueFeedbackDates(c.env);
    console.log("✅ [GET-FEEDBACK-DATES] Returning", dates.length, "dates");
    return c.json(dates);
  } catch (err) {
    console.error("❌ [GET-FEEDBACK-DATES] Exception:", err);
    return c.json({ error: "Failed to fetch dates" }, 500);
  }
}

// ===== GET /analytics/tier-sentiment =====
export async function handleGetTierSentiment(c: AppContext) {
  console.log("📊 [GET-TIER-SENTIMENT] Request received");
  try {
    const data = await getSentimentByTier(c.env);
    const grouped = data.reduce((acc: any, row: any) => {
      if (!acc[row.user_tier]) acc[row.user_tier] = [];
      acc[row.user_tier].push(row.sentiment);
      return acc;
    }, {});
    console.log("✅ [GET-TIER-SENTIMENT] Response sent");
    return c.json(grouped);
  } catch (err) {
    console.error("❌ [GET-TIER-SENTIMENT] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}

// ===== GET /analytics/status-timeline =====
export async function handleGetStatusTimeline(c: AppContext) {
  console.log("📊 [GET-STATUS-TIMELINE] Request received");
  try {
    const data = await getStatusTimeline(c.env);
    console.log("✅ [GET-STATUS-TIMELINE] Response sent");
    return c.json(data);
  } catch (err) {
    console.error("❌ [GET-STATUS-TIMELINE] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}

// ===== GET /analytics/urgency-impact =====
export async function handleGetUrgencyImpact(c: AppContext) {
  console.log("📊 [GET-URGENCY-IMPACT] Request received");
  try {
    const data = await getUrgencyImpactData(c.env);
    console.log("✅ [GET-URGENCY-IMPACT] Response sent");
    return c.json(data);
  } catch (err) {
    console.error("❌ [GET-URGENCY-IMPACT] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}

// ===== GET /analytics/resolution-time =====
export async function handleGetResolutionTime(c: AppContext) {
  console.log("📊 [GET-RESOLUTION-TIME] Request received");
  try {
    const data = await getResolutionTimeByTag(c.env);
    console.log("✅ [GET-RESOLUTION-TIME] Response sent");
    return c.json(data);
  } catch (err) {
    console.error("❌ [GET-RESOLUTION-TIME] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}

// ===== GET /analytics/sentiment-by-dimension =====
export async function handleGetSentimentByDimension(c: AppContext) {
  const dimension = c.req.query("dimension") || "tier";
  console.log("📊 [GET-SENTIMENT-DIMENSION] Request received for:", dimension);
  try {
    const data = await getSentimentByDimension(c.env, dimension as 'status' | 'tag' | 'channel' | 'tier');
    console.log("✅ [GET-SENTIMENT-DIMENSION] Response sent");
    return c.json(data);
  } catch (err) {
    console.error("❌ [GET-SENTIMENT-DIMENSION] Exception:", err);
    return c.json({ error: "Failed to fetch data" }, 500);
  }
}