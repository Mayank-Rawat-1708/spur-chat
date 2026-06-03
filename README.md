# Spur Chat — AI Live Chat Support Agent

A full-stack AI-powered customer support chat widget for SpurStore (fictional e-commerce). Built with Node.js + TypeScript (backend) and Svelte (frontend), using **Groq** (free) as the LLM provider.

---

## Quick Start

### Prerequisites
- Node.js 18+
- A free Groq API key from https://console.groq.com

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

```bash
cd backend
cp .env.example .env
# Open .env and set: GROQ_API_KEY=gsk_your_key_here
```

### 3. Run DB migrations (one-time)

```bash
cd backend
npm run migrate
# Output: ✅ Migrations complete, ✅ FAQ knowledge seeded
```

### 4. Start servers (two terminals)

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open http://localhost:5173

---

## Architecture

```
spur-chat/
├── backend/
│   └── src/
│       ├── index.ts                        # Express app, middleware, startup
│       ├── routes/chat.ts                  # POST /chat/message, GET /chat/history/:id
│       ├── services/
│       │   ├── conversationService.ts      # DB operations
│       │   └── llmService.ts               # Groq API integration
│       ├── db/database.ts                  # SQLite setup, migrations, FAQ seed
│       └── types/index.ts                  # Shared TypeScript interfaces
└── frontend/
    └── src/
        ├── App.svelte                      # Chat UI
        └── lib/api.ts                      # API client
```

### Backend layers
- **Routes** → input validation (Zod), HTTP responses
- **Services** → business logic, DB queries, LLM calls
- **DB** → SQLite via better-sqlite3, WAL mode, foreign keys

---

## API

### POST /chat/message
```json
// Request
{ "message": "What is your return policy?", "sessionId": "optional-uuid" }

// Response
{ "reply": "We accept returns within 30 days...", "sessionId": "uuid", "messageId": "uuid" }
```

### GET /chat/history/:sessionId
Returns all messages for a session (used on page reload).

### GET /health
Returns `{ status: "ok" }`.

---

## Data Model

```sql
conversations (id, created_at, updated_at, metadata)
messages (id, conversation_id, sender CHECK('user'|'ai'), text, created_at, metadata)
faq_knowledge (id, category, question, answer)
```

---

## LLM Integration

- **Provider:** Groq (free — https://console.groq.com)
- **Model:** `llama-3.1-8b-instant` — fast, free, great for support chat
- **Free limits:** 30 req/min, 14,400 req/day
- **Prompting:** System prompt injects full FAQ knowledge base from DB + persona + guardrails. Last 20 messages passed as history for context.
- **Error handling:** 429 rate limit, 401 auth errors, and network failures all return friendly user-facing messages.

---

## Trade-offs & If I Had More Time

- **SQLite → PostgreSQL:** One file change in `database.ts`
- **Streaming replies:** Use Groq's streaming API + SSE for token-by-token display
- **Tool use:** Give the LLM tools like `lookup_order(id)` for real-time data
- **Human handoff:** "Talk to a human" button that creates a support ticket
- **Auth:** JWT + users table, bind conversations to users
- **E2E tests:** Playwright for UI, Supertest for API
