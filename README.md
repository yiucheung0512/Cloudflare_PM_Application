# Cloudflare Feedback Analyzer
A serverless full-stack application built on the Cloudflare Developer Platform. This tool aggregates, analyzes, and visualizes user feedback using Cloudflare Workers, D1, KV, and Workers AI.
[Dashboard Preview](https://application-task.yiucheung0512.workers.dev/)

<img width="300" height="632" alt="image" src="https://github.com/user-attachments/assets/af9d46ec-b5d3-475e-b5a9-e88d3ca99506" />
<img width="300" height="632" alt="image" src="https://github.com/user-attachments/assets/c5476c0f-8872-48b9-a26a-484c1537dd2a" />



## 📌 Overview & Objectives
The Cloudflare Feedback Analyzer is a comprehensive feedback management and analytics platform designed to help teams collect, organize, and understand user feedback at scale. Built entirely on serverless infrastructure, it demonstrates best practices for building modern, cost-effective, real-time data applications on Cloudflare's Developer Platform.

### Primary Objectives
1.  **Centralized Feedback Collection**: Provide a unified interface for capturing structured user feedback with multiple metadata dimensions (sentiment, status, priority, user tier, tags, etc.).

2.  **AI-Powered Intelligence**: Leverage Workers AI to automatically analyze feedback sentiment, generate daily summaries, and extract actionable insights without external API calls.

3.  **Real-Time Analytics**: Enable instant visualization and exploration of feedback patterns across multiple dimensions (time, user segments, issue types) with interactive charts and filtering.

4.  **Scalable Architecture**: Demonstrate a production-ready serverless architecture that handles feedback ingestion, processing, and analytics with minimal operational overhead.

5.  **User Experience**: Create an intuitive dark-mode dashboard that makes feedback insights accessible to non-technical stakeholders while providing advanced features for data analysts.

## 🎯 Core Features
### Data Management
-  **CRUD Operations**: Create, read, update, delete feedback with real-time UI sync and inline editing

-  **Smart Tagging**: Normalized tags (Bug Report, Feature Request, Performance, Security, Feedback) for trend analysis

-  **Multi-Dimensional Filtering**: Simultaneous filtering by status, sentiment, user tier, tags, and channel

-  **Column Customization**: Toggle visibility and reorder table columns to focus on relevant metrics

-  **Advanced Search**: Full-text search with auto-suggestions and click-to-filter from results

-  **Two-Step Deletion**: Confirmation dialogs prevent accidental data loss

### Analytics & Visualization
-  **Sentiment Distribution**: Box plot analysis across user tiers, statuses, tags, and channels (min, Q1, median, Q3, max, mean)

-  **Feedback Timeline**: Interactive Gantt-style view grouped by status, tier, or tag with sticky column headers

-  **Resolution Metrics**: Average resolution time by tag type with color-coded visualization

-  **Urgency Impact Matrix**: Bubble chart for feedback prioritization (Urgency vs. Impact)

-  **Status Workflow Timeline**: Line chart tracking status distribution changes over time

-  **Daily AI Summaries**: Automatic markdown-formatted summaries with date-based filtering

### AI & Intelligence
-  **Auto-Sentiment Analysis**: Workers AI (`@cf/meta/llama-3-8b-instruct`) extracts sentiment (-1 to +1 scale) and generates summaries

-  **Smart Caching**: KV-backed caching ensures sub-100ms response times for repeated queries

-  **Adaptive Suggestions**: Search and filtering options adapt based on feedback patterns

-  **Contextual Analysis**: No external API dependencies—all inference runs on Cloudflare

### User Experience
-  **Dark Mode Theme**: Professionally styled interface with consistent accent colors (#22c55e, #3b82f6, #f59e0b, #ef4444)

-  **Responsive Design**: Adapts to all screen sizes with sticky headers and scrollable components

-  **Themed Scrollbars**: Custom-styled scrollbars matching the interface

-  **Interactive Charts**: Click elements to apply filters; optimized legends and data display

-  **8-Tier User System**: Support for external (Free, Pro, Business, Enterprise) and internal (Developer, QA, Lead, Manager) users

-  **Inline Editing**: Edit feedback text and sentiment directly in tables with save/cancel actions

## 🛠️ Tech Stack
-  **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)

-  **Framework**: [Hono](https://hono.dev/)

-  **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)

-  **Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/)

-  **AI**: [Workers AI](https://developers.cloudflare.com/workers-ai/)

-  **Frontend**: HTML5, Vanilla JS, Chart.js, Chart.js BoxPlot Plugin.

-  **Config**: `wrangler.jsonc`

## ⚙️ Prerequisites
- [Node.js](https://nodejs.org/) (v16.17.0 or later)

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally or via npx.

- A Cloudflare account.


## 🏃‍♂️ Getting Started
### 1. Install Dependencies
```bash

npm  install

```

### 2. Configure Cloudflare Resources
You need to provision the D1 database and KV namespace.


**Create D1 Database:**
```bash

npx  wrangler  d1  create  feedback

```

*Copy the `database_id` from the output and update `wrangler.jsonc`.*

**Create KV Namespace:**
```bash

npx  wrangler  kv  namespace  create  KV

```

*Copy the `id` from the output and update `wrangler.jsonc`.*

**Update `wrangler.jsonc`:**
```jsonc

"d1_databases": [

{

"binding": "DB",

"database_name": "feedback",

"database_id": "<YOUR_D1_DATABASE_ID>"

}

],

"kv_namespaces": [

{

"binding": "KV",

"id": "<YOUR_KV_NAMESPACE_ID>"

}

]

```

**Fix Types and Class Bindings**
[For generating/synchronizing types based on your Worker configuration run](https://developers.cloudflare.com/workers/wrangler/commands/#types)


Pass the `CloudflareBindings` as generics:
```bash

npm  run  cf-typegen

```

### 3. Initialize Database
Apply the schema and seed initial data.

**For Local Development:**
```bash

npx  wrangler  d1  execute  feedback  --local  --file  schema.sql

```

**For Production:**
```bash

npx  wrangler  d1  execute  feedback  --remote  --file  schema.sql

```

  

### 4. Run Locally
Start the local development server.

```bash

npm  run  dev

```

Open [http://localhost:8787] in your browser.

  

## 🚀 Deployment
Deploy your worker to the Cloudflare global network.

  

```bash

npm  run  deploy

```

*This command runs `wrangler deploy --minify`.*

  

## 📂 Project Structure
```

├── public/ # Static frontend assets

│ ├── index.html # Main dashboard UI

│ └── dashboard.js # Frontend logic & charts

├── src/

│ ├── index.ts # Main Worker entry & Hono app

│ ├── handlers.ts # Route handlers (GET, POST, PATCH)

│ ├── db.ts # D1 database queries

│ ├── ai.ts # Workers AI integration

│ └── types.ts # Types and utilities

├── schema.sql # Database schema & seed data

├── wrangler.jsonc # Worker configuration

└── package.json # Dependencies & scripts

```

  

## 📝 API Endpoints 

-  `GET /` - Serves the dashboard.

-  `GET /data` - Fetch all feedback entries.

-  `GET /summary` - Get AI-generated summary (cached).

-  `GET /search?q=...` - Search feedback.

-  `POST /feedback` - Submit new feedback.

-  `PATCH /feedback/:id` - Update status, text, or tag.

-  `GET /analytics/*` - Various endpoints for chart data.

  

## 🤝 Vibe-Coding Context
This project was built using **VS Code** with **GitHub Copilot** (Agent Mode) to rapidly prototype the full-stack solution, bridge Hono with D1, and generate complex Chart.js visualizations.

  

## 🚀 Potential Improvements for Future Development & Enhancement

- **Actual API Integration**: Connect to actual product feedback API endpoints (i.e. Customer Support Tickets, Discord, GitHub issues, email, X/Twitter, community forums, etc).

-  **Predictive Analytics**: Use historical feedback patterns to predict resolution times, assign priority scores, and forecast issue volumes.

-  **Trend Detection**: Identify emerging issues by analyzing feedback topic clustering and sentiment shifts over time.

-  **Custom Dashboards**: Allow users to create personalized dashboard views with saved filter combinations and pinned charts.

-  **Export Functionality**: Enable PDF/CSV export of feedback reports, charts, and summaries for stakeholder presentations.

-  **Time-Based Analytics**: Heatmaps showing feedback submission patterns (by day-of-week, hour, etc.) to optimize team response times.

-  **Team Assignments**: Assign feedback to team members with workload balancing and ownership tracking.

-  **Comments & Discussions**: Thread-based comments on feedback entries for collaborative analysis and context.

-  **Activity Audit Log**: Track all changes (edits, status updates, assignments) with user attribution and timestamps.

-  **Notification System**: Real-time alerts for high-priority feedback, SLA breaches, and status milestone completions.

-  **Bulk Operations**: Select multiple feedback items for batch status updates, tag assignments, or tier changes.

-  **Webhook Support**: Allow external systems to subscribe to feedback events (new feedback, status changes, etc.).

-  **Third-Party LLM Support**: Pluggable sentiment analysis and summary generation supporting OpenAI, Anthropic, or open-source models.

-  **Custom Fields**: Allow administrators to define custom metadata fields for domain-specific feedback properties.

-  **API Rate Limiting & Analytics**: Track API usage, enforce rate limits, and provide usage analytics for enterprise customers.

-  **Multi-Tenancy**: Support multiple independent feedback systems within a single deployment with user/team isolation.

-  **RBAC (Role-Based Access Control)**: Fine-grained permissions (viewer, commenter, editor, admin) for team members.

-  **SSO Integration**: Support OAuth2/SAML for enterprise authentication with Okta, Entra ID, and other IdP providers.

-  **Compliance & Data Residency**: GDPR/CCPA compliance features including data anonymization and retention policies.

-  **Advanced Analytics Engine**: Time-series analysis, anomaly detection, and predictive models using Workers AI or external ML services.

-  **Mobile App**: Native iOS/Android apps for feedback submission and quick browsing on mobile devices.

- Add Service Worker support for offline feedback submission and local caching.

- Optimize D1 queries with materialized views for heavy analytics workloads.


### Known Limitations & Improvement Areas

-  **Chart Performance**: Large datasets (1000+ feedback items) may cause chart rendering delays; consider pagination or aggregation.

-  **Sentiment Model Accuracy**: LLM-based sentiment detection may require fine-tuning for domain-specific terminology.

-  **Timeline Visualization**: Very long timespans with many parallel items can become visually cluttered; consider grouping/zooming.

-  **Search Indexing**: Full-text search is currently DB-based; consider migrating to Cloudflare Search for better performance.

-  **Mobile Responsiveness**: Some chart visualizations don't render optimally on mobile; redesign for mobile-first viewing.
