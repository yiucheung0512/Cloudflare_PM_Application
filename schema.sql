-- D1 schema for feedback analyzer
DROP TABLE IF EXISTS feedback;

CREATE TABLE feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  source TEXT,
  channel TEXT,
  severity_hint TEXT,
  user_tier TEXT,
  tag TEXT,
  sentiment REAL,
  urgency_score REAL,
  summary TEXT,
  status TEXT DEFAULT 'To Do',
  created_at TEXT DEFAULT (datetime('now')),
  analyzed_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX idx_feedback_tag ON feedback(tag);
CREATE INDEX idx_feedback_status ON feedback(status);

-- Extended mock data with 35+ rows, diverse tiers (free/pro/business/enterprise/developer/tester), and varied sentiments/statuses
INSERT INTO feedback (text, source, channel, severity_hint, user_tier, tag, sentiment, urgency_score, status, created_at, updated_at) VALUES
('Your CLI install failed on Windows ARM.', 'dev_sam', 'support', 'high', 'free', 'Bug Report', -0.8, 0.9, 'To Do', '2026-01-19 13:00:00', '2026-01-19 13:00:00'),
('Request: webhook retries with exponential backoff.', 'pm_tina', 'twitter', 'medium', 'pro', 'Feature Request', 0.1, 0.6, 'To Do', '2026-01-20 08:15:00', '2026-01-20 08:15:00'),
('Bot traffic bypassing firewall rules. Urgent!', 'ops_joe', 'discord', 'high', 'business', 'Security', -0.9, 0.95, 'to be reviewed', '2026-01-21 09:45:00', '2026-01-25 11:30:00'),
('Need S3/R2 audit log export feature.', 'secops_team', 'email', 'medium', 'enterprise', 'Feature Request', 0.0, 0.7, 'in progress', '2026-01-22 14:15:00', '2026-01-25 14:00:00'),
('Dashboard timeout on large date ranges.', 'user42', 'web', 'high', 'pro', 'Performance', -0.6, 0.85, 'To Do', '2026-01-23 12:30:00', '2026-01-25 10:00:00'),
('Love the new API docs, super clear!', 'dev_jane', 'github', 'low', 'free', 'Praise', 0.95, 0.1, 'done', '2026-01-24 16:45:00', '2026-01-24 17:00:00'),
('Database query performance degraded by 50%.', 'dba_mark', 'support', 'high', 'developer', 'Performance', -0.75, 0.88, 'in progress', '2026-01-24 10:00:00', '2026-01-26 08:00:00'),
('Request OAuth2 PKCE flow support.', 'security_alice', 'email', 'medium', 'enterprise', 'Security', 0.2, 0.65, 'To Do', '2026-01-23 15:30:00', '2026-01-23 15:30:00'),
('Mobile app crashes on Android 13.', 'qa_robert', 'github', 'high', 'tester', 'Bug Report', -0.85, 0.92, 'To Do', '2026-01-22 11:00:00', '2026-01-22 11:00:00'),
('Billing integration seems smooth now.', 'customer_sue', 'web', 'low', 'pro', 'Praise', 0.8, 0.15, 'done', '2026-01-25 09:30:00', '2026-01-25 10:00:00'),
('Rate limiting docs are confusing.', 'dev_carlos', 'slack', 'low', 'free', 'Other', -0.3, 0.4, 'to be reviewed', '2026-01-25 14:20:00', '2026-01-26 09:00:00'),
('Could we add bulk delete API?', 'ops_lily', 'email', 'medium', 'business', 'Feature Request', 0.3, 0.55, 'To Do', '2026-01-24 13:45:00', '2026-01-24 13:45:00'),
('Test suite integration with GitHub Actions broken.', 'qa_david', 'github', 'high', 'tester', 'Bug Report', -0.7, 0.8, 'in progress', '2026-01-23 08:30:00', '2026-01-26 10:30:00'),
('Customer portal redesign is fantastic!', 'user_emma', 'twitter', 'low', 'pro', 'Praise', 0.85, 0.2, 'done', '2026-01-25 17:00:00', '2026-01-25 17:15:00'),
('Edge caching not working as expected.', 'dev_frank', 'support', 'high', 'developer', 'Performance', -0.65, 0.75, 'To Do', '2026-01-25 06:00:00', '2026-01-25 06:00:00'),
('Support response time has improved significantly.', 'user_grace', 'discord', 'low', 'free', 'Praise', 0.9, 0.05, 'done', '2026-01-26 12:00:00', '2026-01-26 12:15:00'),
('Please add 2FA to dashboard access.', 'security_henry', 'email', 'high', 'enterprise', 'Security', 0.1, 0.8, 'in progress', '2026-01-22 16:00:00', '2026-01-26 08:00:00'),
('API key rotation mechanism needed urgently.', 'secops_iris', 'slack', 'high', 'business', 'Urgent', -0.8, 0.9, 'To Do', '2026-01-25 10:15:00', '2026-01-25 10:15:00'),
('Webhook signature verification easy to implement.', 'dev_jack', 'github', 'low', 'developer', 'Praise', 0.75, 0.25, 'done', '2026-01-24 14:30:00', '2026-01-24 15:00:00'),
('GraphQL schema documentation is incomplete.', 'dev_karen', 'support', 'medium', 'tester', 'Other', -0.2, 0.45, 'to be reviewed', '2026-01-24 09:00:00', '2026-01-26 10:00:00'),
('Search indexes causing high memory usage.', 'ops_lewis', 'email', 'high', 'enterprise', 'Performance', -0.7, 0.85, 'in progress', '2026-01-21 07:00:00', '2026-01-26 14:00:00'),
('Rate limit errors should provide retry-after header.', 'dev_mike', 'slack', 'medium', 'pro', 'Feature Request', 0.0, 0.6, 'To Do', '2026-01-25 11:30:00', '2026-01-25 11:30:00'),
('Batch endpoint works perfectly now!', 'customer_nancy', 'web', 'low', 'business', 'Praise', 0.88, 0.1, 'done', '2026-01-26 08:45:00', '2026-01-26 09:00:00'),
('CORS policy blocking localhost requests.', 'dev_oscar', 'github', 'high', 'developer', 'Bug Report', -0.6, 0.7, 'To Do', '2026-01-25 15:00:00', '2026-01-25 15:00:00'),
('Timezone handling in webhooks inconsistent.', 'qa_patricia', 'support', 'medium', 'tester', 'Bug Report', -0.45, 0.55, 'to be reviewed', '2026-01-24 12:30:00', '2026-01-26 11:00:00'),
('Could we support custom webhook headers?', 'dev_quinn', 'email', 'low', 'pro', 'Feature Request', 0.2, 0.5, 'To Do', '2026-01-23 10:00:00', '2026-01-23 10:00:00'),
('SSL certificate rotation automated successfully.', 'ops_rachel', 'slack', 'low', 'enterprise', 'Praise', 0.92, 0.08, 'done', '2026-01-26 16:00:00', '2026-01-26 16:15:00'),
('Backup restore procedure takes too long.', 'dba_steve', 'email', 'high', 'developer', 'Bug Report', -0.55, 0.75, 'in progress', '2026-01-20 11:00:00', '2026-01-26 09:30:00'),
('Email notifications working great now.', 'user_tina', 'twitter', 'low', 'free', 'Praise', 0.87, 0.12, 'done', '2026-01-26 13:00:00', '2026-01-26 13:15:00'),
('Request: Audit log retention policy settings.', 'compliance_uma', 'email', 'medium', 'business', 'Feature Request', 0.15, 0.65, 'To Do', '2026-01-25 14:45:00', '2026-01-25 14:45:00'),
('Webhook delivery failures not retrying properly.', 'dev_victor', 'support', 'high', 'tester', 'Bug Report', -0.72, 0.82, 'in progress', '2026-01-22 09:00:00', '2026-01-26 10:00:00'),
('Very impressed with the new dashboard UI!', 'user_wendy', 'discord', 'low', 'pro', 'Praise', 0.9, 0.15, 'done', '2026-01-26 10:30:00', '2026-01-26 10:45:00'),
('Connection pool exhaustion under load.', 'ops_xavier', 'slack', 'high', 'enterprise', 'Performance', -0.65, 0.8, 'To Do', '2026-01-25 08:00:00', '2026-01-25 08:00:00'),
('Inconsistent behavior in batch operations.', 'qa_yolanda', 'github', 'medium', 'developer', 'Bug Report', -0.5, 0.62, 'to be reviewed', '2026-01-23 14:00:00', '2026-01-26 12:00:00'),
('API versioning strategy is well-documented.', 'dev_zack', 'email', 'low', 'free', 'Praise', 0.8, 0.2, 'done', '2026-01-26 14:00:00', '2026-01-26 14:15:00');


