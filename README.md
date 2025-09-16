# Lead Scoring Backend

## Project overview

A small Next.js (App Router) backend that:

- Accepts product/offer details (`POST /api/offer`).
- Accepts a CSV of leads (`POST /api/leads/upload`) and groups them into a batch.
- Runs a two-layer scoring pipeline (`POST /api/score`) that combines deterministic rule-based points with AI reasoning (Gemini).
- Returns scored results as JSON (`GET /api/results`) or downloadable CSV (`GET /api/results/csv`).

---

## Required files in repo

- `prisma/schema.prisma` (models: `Offer`, `Batch`, `Lead`, `LeadResult`)
- `lib/prisma.ts` (Prisma client)
- `lib/gemini.ts` (Gemini SDK helper)
- API routes under `app/api/`:

  - `offer/route.ts` (POST /api/offer)
  - `leads/upload/route.ts` (POST /api/leads/upload)
  - `score/route.ts` (POST /api/score)
  - `results/route.ts` (GET /api/results)
  - `results/csv/route.ts` (GET /api/results/csv)

---

## Setup steps

1. Clone the repo and install dependencies:

```bash
git clone https://github.com/SyedFaizan8/kuvaka.git
cd kuvaka
npm install
```

2. Create `.env` in project root with these variables:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
GEMINI_API_KEY="your_gemini_api_key_here"
GEMINI_MODEL="gemini-2.5-flash"
NODE_ENV=development
```

3. Prisma setup — generate client and run migrations:

```bash
npx prisma migrate
npx prisma generate
```

4. Start the dev server:

```bash
npm run dev
```

The app runs on `http://localhost:3000` (default). Ensure your Postgres is reachable from `DATABASE_URL`.

---

## API usage examples (cURL)

> Replace host with your deployment (e.g. `https://kuvaka.syedfaizan.in/api`) and adjust IDs/filepaths.

### 1) Create an offer

```bash
curl -X POST "https://kuvaka.syedfaizan.in/api/offer" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AI Outreach Automation",
    "value_props": ["24/7 outreach","6x more meetings"],
    "ideal_use_cases": ["B2B SaaS mid-market"]
  }'
```

### 2) Upload leads (CSV + offerId)

```bash
curl -X POST "https://kuvaka.syedfaizan.in/api/leads/upload" \
  -F "offerId=1" \
  -F "file=@/path/to/leads_saas.csv"
```

CSV header must be: `name,role,company,industry,location,linkedin_bio`

### 3) Run scoring

```bash
curl -X POST "https://kuvaka.syedfaizan.in/api/score" \
  -H "Content-Type: application/json" \
  -d '{"batchId": 123, "offerId": 1}'
```

### 4) Get JSON results

```bash
curl "https://kuvaka.syedfaizan.in/api/results?batchId=123"
```

### 5) Download CSV results

```bash
curl -OJ "https://kuvaka.syedfaizan.in/api/results/csv?batchId=123"
```

---

## API usage: Postman quick steps

1. **Create Offer** (POST `/api/offer`) — body type: raw JSON (application/json) with `name`, `value_props`, `ideal_use_cases`.
2. **Upload Leads** (POST `/api/leads/upload`) — body type: form-data; keys: `offerId` (text), `file` (file).
3. **Run Scoring** (POST `/api/score`) — body type: raw JSON `{ batchId, offerId }`.
4. **Get Results (JSON)** (GET `/api/results?batchId=...`) or **Download CSV** (GET `/api/results/csv?batchId=...`).

---

## Explanation of rule logic

Each lead receives a **rule score** (0–50) plus an **AI score** (0–50). Final score is `rule_score + ai_points` (capped at 100).

Rule layer (max 50):

- **Role relevance**:

  - Decision maker (CEO, Founder, Head of, VP, Director, CTO, etc.) → **+20**
  - Influencer (Manager, Lead, Senior, Principal, Growth/Product/Marketing manager) → **+10**
  - Else → 0

- **Industry match** (compares lead.industry to `offer.idealUseCases`):

  - Exact match → **+20**
  - Adjacent / substring / word overlap → **+10**
  - Else → 0

- **Data completeness**: all required fields present (`name, role, company, industry, location`) → **+10**

AI layer (max 50):

- The backend sends a prompt to Gemini including the `offer` details and the `lead` record.
- The prompt asks Gemini to **classify intent** precisely as `High`, `Medium`, or `Low` and provide a 1–2 sentence reason.
- Mapping: **High = 50**, **Medium = 30**, **Low = 10**.

Example scoring flow (brief):

- Rule: decision-maker (+20) + industry exact (+20) + complete (+10) = 50
- AI: High → +50
- Final = 50 + 50 = 100

---

## Prompts used for Gemini

I used a deterministic prompt asking for a strict 2-line output to simplify parsing:

```
You are a sales qualification assistant.
Product/Offer: <offer.name>
Value propositions: <valueProps joined>
Ideal use cases: <idealUseCases joined>

Prospect:
Name: <lead.name>
Role: <lead.role>
Company: <lead.company>
Industry: <lead.industry>
Location: <lead.location>
LinkedIn Bio: <lead.linkedinBio or N/A>

Task: Classify intent as exactly one of: High, Medium, Low.
Respond in this exact format:

INTENT: <High|Medium|Low>
REASON: <One or two sentence explanation why.>

Only output those two lines (INTENT and REASON).
```

The code includes a parser (`parseGeminiIntent`) which extracts the `INTENT` and the `REASON` robustly, and falls back to heuristics if the model deviates.

---

## Troubleshooting

- Run `npx prisma generate` whenever your Prisma schema changes.
- Ensure CSV header matches exactly: `name,role,company,industry,location,linkedin_bio`.
- There is some dummy csv files in code base to test.

---
