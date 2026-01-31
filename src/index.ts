import { Hono } from "hono";
import { serveStatic } from "hono/cloudflare-workers";
import type { CloudflareBindings } from "./types";
import {
  handlePostFeedback,
  handlePatchFeedback,
  handleDeleteFeedback,
  handleGetData,
  handleGetSummary,
  handleGetSearch,
  handleGetHealth,
  handleGetTierSentiment,
  handleGetStatusTimeline,
  handleGetUrgencyImpact,
  handleGetResolutionTime,
  handleGetSentimentByDimension,
  handleGetDailySummary,
  handleGetFeedbackDates,
} from "./handlers";

console.log("🚀 [MAIN] Starting Feedback Analyzer Worker");

const app = new Hono<{ Bindings: CloudflareBindings }>();

// ===== STATIC FILES =====
console.log("📁 [ROUTES] Setting up static file serving");
app.use("/dashboard.js", serveStatic({ path: "./public/dashboard.js", manifest: {} }));
app.get("/", serveStatic({ path: "./public/index.html", manifest: {} }));

// ===== API ROUTES =====
console.log("🔗 [ROUTES] Setting up API endpoints");

app.post("/feedback", handlePostFeedback);
app.patch("/feedback/:id", handlePatchFeedback);
app.delete("/feedback/:id", handleDeleteFeedback);
app.get("/data", handleGetData);
app.get("/summary", handleGetSummary);
app.get("/search", handleGetSearch);
app.get("/health", handleGetHealth);
app.get("/analytics/tier-sentiment", handleGetTierSentiment);
app.get("/analytics/status-timeline", handleGetStatusTimeline);
app.get("/analytics/urgency-impact", handleGetUrgencyImpact);
app.get("/analytics/resolution-time", handleGetResolutionTime);
app.get("/analytics/sentiment-by-dimension", handleGetSentimentByDimension);
app.get("/analytics/daily-summary", handleGetDailySummary);
app.get("/analytics/feedback-dates", handleGetFeedbackDates);

console.log("✅ [MAIN] All routes registered");

export default app;