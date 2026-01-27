# Cloudflare_PM_Application: Feedback Analyzer
A product management dashboard developed for Cloudflare's pm intern application. 

A serverless full-stack application built on the Cloudflare Developer Platform. This tool aggregates, analyzes, and visualizes user feedback using Cloudflare Workers, D1, KV, and Workers AI.

[Dashboard Preview](https://application-task.yiucheung0512.workers.dev/)

<img width="372" height="704" alt="image" src="https://github.com/user-attachments/assets/5207fd0a-5795-4a15-ae4d-f9c3e58133e2" />


## 🚀 Features

- **Feedback Management**: CRUD operations for user feedback with statuses (To Do, In Progress, Done, etc.).
- **AI Analysis**: Uses Workers AI (`@cf/meta/llama-3-8b-instruct`) to generate summaries and tag sentiment.
- **Advanced Analytics**:
  - **Sentiment Box Plots**: Analyze sentiment spread across user tiers.
  - **Workflow Timeline**: Track status changes over time.
  - **Resolution Time**: Average time to resolve specific tags.
  - **Urgency Matrix**: Bubble chart visualizing Urgency vs. Impact.
- **Smart Search**: Search feedback with auto-suggestions and interactive result selection.
- **Performance**:
  - **D1 (SQLite)** for structured data storage.
  - **KV** for caching expensive AI summaries.
  - **Static Assets** served directly from the Worker.

## 🛠️ Tech Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/)
- **AI**: [Workers AI](https://developers.cloudflare.com/workers-ai/)
- **Frontend**: HTML5, Vanilla JS, Chart.js, Chart.js BoxPlot Plugin.
- **Config**: `wrangler.jsonc`

## ⚙️ Prerequisites

- [Node.js](https://nodejs.org/) (v16.17.0 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed globally or via npx.
- A Cloudflare account.

---

## 🏃‍♂️ Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Cloudflare Resources

You need to provision the D1 database and KV namespace.

**Create D1 Database:**
```bash
npx wrangler d1 create feedback
```
*Copy the `database_id` from the output and update `wrangler.jsonc`.*

**Create KV Namespace:**
```bash
npx wrangler kv namespace create KV
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
npm run cf-typegen
```

### 3. Initialize Database

Apply the schema and seed initial data.

**For Local Development:**
```bash
npx wrangler d1 execute feedback --local --file schema.sql
```

**For Production:**
```bash
npx wrangler d1 execute feedback --remote --file schema.sql
```

### 4. Run Locally

Start the local development server.

```bash
npm run dev
```
Open [http://localhost:8787] in your browser.

## 🚀 Deployment

Deploy your worker to the Cloudflare global network.

```bash
npm run deploy
```
*This command runs `wrangler deploy --minify`.*

---

## 📂 Project Structure

```
├── public/              # Static frontend assets
│   ├── index.html       # Main dashboard UI
│   └── dashboard.js     # Frontend logic & charts
├── src/
│   ├── index.ts         # Main Worker entry & Hono app
│   ├── handlers.ts      # Route handlers (GET, POST, PATCH)
│   ├── db.ts            # D1 database queries
│   ├── ai.ts            # Workers AI integration
│   └── types.ts        # Types and utilities
├── schema.sql           # Database schema & seed data
├── wrangler.jsonc       # Worker configuration
└── package.json         # Dependencies & scripts
```

## 📝 API Endpoints

- `GET /` - Serves the dashboard.
- `GET /data` - Fetch all feedback entries.
- `GET /summary` - Get AI-generated summary (cached).
- `GET /search?q=...` - Search feedback.
- `POST /feedback` - Submit new feedback.
- `PATCH /feedback/:id` - Update status, text, or tag.
- `GET /analytics/*` - Various endpoints for chart data.

## 🤝 Vibe-Coding Context

This project was built using **VS Code** with **GitHub Copilot** (Agent Mode) to rapidly prototype the full-stack solution, bridge Hono with D1, and generate complex Chart.js visualizations.
