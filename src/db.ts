import type { CloudflareBindings, FeedbackRow } from "./types";

console.log("✓ db.ts loaded");

const SUMMARY_CACHE_KEY = "latest_summary";

export async function insertFeedback(
  env: CloudflareBindings,
  feedback: string,
  source: string,
  channel: string,
  severityHint: string | null,
  userTier: string | null
) {
  console.log("💾 [DB-INSERT] Inserting feedback from", source);
  
  const insert = await env.DB.prepare(
    "INSERT INTO feedback (text, source, channel, severity_hint, user_tier, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).bind(feedback, source, channel, severityHint, userTier).run();

  console.log("✅ [DB-INSERT] Inserted with ID:", insert.meta.last_row_id);
  return insert.meta.last_row_id;
}

export async function updateFeedbackAnalysis(
  env: CloudflareBindings,
  id: number,
  tag: string,
  sentiment: number,
  urgency: number,
  summary: string
) {
  console.log("📝 [DB-UPDATE] Updating analysis for ID:", id);
  
  await env.DB.prepare(
    "UPDATE feedback SET tag = ?, sentiment = ?, urgency_score = ?, summary = ?, analyzed_at = datetime('now') WHERE id = ?"
  ).bind(tag, sentiment, urgency, summary, id).run();

  console.log("✅ [DB-UPDATE] Updated");
}

export async function updateFeedbackStatus(
  env: CloudflareBindings,
  id: number,
  status: string
) {
  console.log("📝 [DB-UPDATE-STATUS] Updating status for ID:", id, "to:", status);
  
  await env.DB.prepare(
    "UPDATE feedback SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, id).run();

  console.log("✅ [DB-UPDATE-STATUS] Updated");
}

export async function updateFeedbackSentiment(
  env: CloudflareBindings,
  id: number,
  sentiment: number
) {
  console.log("📝 [DB-UPDATE-SENTIMENT] Updating sentiment for ID:", id, "to:", sentiment);
  
  await env.DB.prepare(
    "UPDATE feedback SET sentiment = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(sentiment, id).run();

  console.log("✅ [DB-UPDATE-SENTIMENT] Updated");
}

export async function updateFeedbackText(
  env: CloudflareBindings,
  id: number,
  text: string,
  tag: string
) {
  console.log("📝 [DB-UPDATE-TEXT] Updating text for ID:", id);
  
  await env.DB.prepare(
    "UPDATE feedback SET text = ?, tag = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(text, tag, id).run();

  console.log("✅ [DB-UPDATE-TEXT] Updated");
}

export async function getAllFeedback(env: CloudflareBindings) {
  console.log("📋 [DB-GET-ALL] Fetching all feedback");
  
  const rows = await env.DB.prepare(
    "SELECT id, text, source, channel, tag, sentiment, urgency_score, summary, status, user_tier, created_at, analyzed_at, updated_at FROM feedback ORDER BY updated_at DESC LIMIT 100"
  ).all();

  console.log("✅ [DB-GET-ALL] Retrieved", rows.results?.length || 0, "rows");
  return rows.results || [];
}

export async function getTagCounts(env: CloudflareBindings) {
  console.log("📊 [DB-TAGS] Fetching tag counts");
  
  const rows = await env.DB.prepare(
    "SELECT tag, COUNT(*) as count FROM feedback WHERE tag IS NOT NULL GROUP BY tag"
  ).all();

  console.log("✅ [DB-TAGS] Got", rows.results?.length || 0, "tag groups");
  return rows.results || [];
}

export async function getSentimentCounts(env: CloudflareBindings) {
  console.log("📊 [DB-SENTIMENT] Fetching sentiment counts");
  
  const rows = await env.DB.prepare(
    `SELECT sentiment_bucket, COUNT(*) as count FROM (
        SELECT CASE 
          WHEN sentiment >= 0.25 THEN 'positive'
          WHEN sentiment <= -0.25 THEN 'negative'
          ELSE 'neutral'
        END as sentiment_bucket
        FROM feedback WHERE sentiment IS NOT NULL
      ) GROUP BY sentiment_bucket`
  ).all();

  console.log("✅ [DB-SENTIMENT] Got", rows.results?.length || 0, "sentiment groups");
  return rows.results || [];
}

export async function getLatestAnalyzedFeedback(env: CloudflareBindings) {
  console.log("📋 [DB-LATEST] Fetching latest analyzed feedback");
  
  const rows = await env.DB.prepare(
    "SELECT text, tag, sentiment FROM feedback WHERE analyzed_at IS NOT NULL ORDER BY analyzed_at DESC LIMIT 25"
  ).all();

  console.log("✅ [DB-LATEST] Got", rows.results?.length || 0, "items");
  return rows.results || [];
}

export async function searchFeedback(env: CloudflareBindings, query: string) {
  console.log("🔍 [DB-SEARCH] Searching for:", query);
  
  const rows = await env.DB.prepare(
    "SELECT id, text, tag, sentiment, status, user_tier, channel, created_at FROM feedback WHERE text LIKE ? ORDER BY created_at DESC LIMIT 20"
  ).bind(`%${query}%`).all();

  console.log("✅ [DB-SEARCH] Found", rows.results?.length || 0, "matches");
  return rows.results || [];
}

export async function getCachedSummary(env: CloudflareBindings, forceRefresh = false) {
  if (forceRefresh) {
    console.log("⏭️ [CACHE] Force refresh requested, skipping cache");
    return null;
  }

  console.log("💾 [CACHE] Fetching cached summary");
  const cached = await env.KV.get(SUMMARY_CACHE_KEY, "json");
  if (cached) {
    console.log("✅ [CACHE] Found cached summary");
    return cached;
  }
  console.log("⏭️ [CACHE] No cached summary, will regenerate");
  return null;
}

export async function setCachedSummary(env: CloudflareBindings, data: any) {
  console.log("💾 [CACHE] Caching summary (TTL: 5min)");
  await env.KV.put(SUMMARY_CACHE_KEY, JSON.stringify(data), { expirationTtl: 300 });
  console.log("✅ [CACHE] Summary cached");
}

export async function getSentimentByTier(env: CloudflareBindings) {
  console.log("📊 [DB-TIER-SENTIMENT] Fetching sentiment by tier");
  
  const rows = await env.DB.prepare(
    `SELECT user_tier, sentiment FROM feedback WHERE sentiment IS NOT NULL ORDER BY user_tier, sentiment`
  ).all();

  console.log("✅ [DB-TIER-SENTIMENT] Got", rows.results?.length || 0, "records");
  return rows.results || [];
}

export async function getSentimentByDimension(env: CloudflareBindings, dimension: 'status' | 'tag' | 'channel' | 'tier') {
  console.log(`📊 [DB-DIMENSION-SENTIMENT] Fetching sentiment by ${dimension}`);
  
  const columnMap: Record<string, string> = {
    tier: 'user_tier',
    status: 'status',
    tag: 'tag',
    channel: 'channel'
  };
  const column = columnMap[dimension] || 'user_tier';
  
  const query = `SELECT ${column} as dimension, sentiment FROM feedback WHERE ${column} IS NOT NULL AND sentiment IS NOT NULL ORDER BY ${column}, sentiment`;
  const rows = await env.DB.prepare(query).all();
  
  // Group by dimension
  const grouped: Record<string, number[]> = {};
  const results = (rows.results as Array<{dimension: string; sentiment: number}>) || [];
  for (const row of results) {
    const key = row.dimension || 'unknown';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row.sentiment);
  }
  
  console.log(`✅ [DB-DIMENSION-SENTIMENT] Got ${Object.keys(grouped).length} unique ${dimension}s`);
  return grouped;
}

export async function getStatusTimeline(env: CloudflareBindings) {
  console.log("📊 [DB-STATUS-TIMELINE] Fetching status counts by day");
  
  const rows = await env.DB.prepare(
    `SELECT 
      DATE(updated_at) as date,
      status,
      COUNT(*) as count
    FROM feedback
    GROUP BY DATE(updated_at), status
    ORDER BY DATE(updated_at)`
  ).all();

  console.log("✅ [DB-STATUS-TIMELINE] Got", rows.results?.length || 0, "status records");
  return rows.results || [];
}

export async function getUrgencyImpactData(env: CloudflareBindings) {
  console.log("📊 [DB-URGENCY-IMPACT] Fetching urgency and impact data");
  
  const rows = await env.DB.prepare(
    `SELECT id, tag, urgency_score, ABS(sentiment) as impact, status, created_at
     FROM feedback
     WHERE urgency_score IS NOT NULL
     ORDER BY urgency_score DESC LIMIT 50`
  ).all();

  console.log("✅ [DB-URGENCY-IMPACT] Got", rows.results?.length || 0, "records");
  return rows.results || [];
}

export async function getResolutionTimeByTag(env: CloudflareBindings) {
  console.log("📊 [DB-RESOLUTION-TIME] Fetching avg resolution time by tag");
  
  const rows = await env.DB.prepare(
    `SELECT 
      tag,
      CAST(AVG(CAST((julianday(updated_at) - julianday(created_at)) * 24 AS INTEGER)) AS INTEGER) as avg_hours,
      COUNT(*) as count
    FROM feedback
    WHERE tag IS NOT NULL 
      AND updated_at IS NOT NULL 
      AND created_at IS NOT NULL
      AND updated_at != created_at
    GROUP BY tag
    ORDER BY avg_hours DESC`
  ).all();

  console.log("✅ [DB-RESOLUTION-TIME] Got", rows.results?.length || 0, "tag records");
  return rows.results || [];
}

export async function invalidateSummaryCache(env: CloudflareBindings) {
  console.log("[DB-CACHE] Invalidating summary cache");
  try {
    await env.KV.delete("feedback_summary_cache");
    console.log("✅ [DB-CACHE] Summary cache invalidated");
  } catch (err) {
    console.error("❌ [DB-CACHE] Error invalidating cache:", err);
  }
}

