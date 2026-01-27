import type { Context } from "hono";

export type CloudflareBindings = {
  DB: D1Database;
  KV: KVNamespace;
  AI: any;
  AI_SEARCH?: any;
};

export type ClassificationResult = {
  tag: string;
  sentiment: number;
  urgency: number;
  summary: string;
};

export type FeedbackRow = {
  id: number;
  text: string;
  source: string;
  channel: string;
  tag: string | null;
  sentiment: number | null;
  urgency_score: number | null;
  summary: string | null;
  created_at: string;
  analyzed_at: string | null;
};

export type AppContext = Context<{ Bindings: CloudflareBindings }>;
