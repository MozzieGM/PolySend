# PolySend

**English** · [Português](README.pt-BR.md)

**PolySend** is a live email-writing studio powered by **OpenCode Go** models.

![PolySend preview](img/preview-en.png)

The UI is a **single responsive dashboard** with no page scroll: brief on the left, email in the
center, and the live model catalog on the right. Plan usage stays visible right below the email.
On smaller screens the catalog becomes a drawer; on phones the app switches to tabs
(Briefing / Email / Models).

The interface ships in **English (default)** and **Portuguese**, with an EN/PT toggle in the
header. The language used to write the email is a separate field in the brief, so you can have
an English UI and a Portuguese email.

The live Go catalog (31 models at the moment) shows prices per 1M tokens, the monthly limit per
model, and real plan usage (5-hour, weekly, and monthly windows). Text is streamed token by token
over SSE and can be edited, refined, or rewritten by selection.

When the draft is ready, **Send** delivers it as a real email through **Resend**, with sender
identity, domain verification, test sends, and per-session delivery history built into the app.

```
React + Vite  ·  Node/Express  ·  OpenCode Go API  ·  SSE  ·  Resend
```

## Run

Requirements: Node 20+.

```bash
npm install
cp .env.example .env   # if you don't have a .env yet
npm run dev
```

Open `http://localhost:5173`.

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env
npm run dev
```

This project already has a `.env` and the server reads the key from there. You can also paste a
different key in the **Configure API** panel without restarting anything.

### Production build

```bash
npm run build
npm start
```

Runs at `http://localhost:8787` (Express serves the Vite build and the `/api` routes).

## How the demo works

1. **Live catalog** — the list comes from `GET https://opencode.ai/inference/go/v1/models`. It
   shows name, input/output price, context, ZDR/free badges, and the monthly limit per model on
   the selected plan (Go, Go Plus, or Go Teams).
2. **Brief** — recipient, company, goal, tone, length, language, context, and signature. Four
   ready-made examples: quote request, follow-up, meeting, and invoice reminder.
3. **Real streaming** — the backend opens the Go API stream and forwards deltas over SSE. The
   subject is separated from the body in the first chunk of the response.
4. **Plan usage** — `GET https://opencode.ai/inference/go/v1/usage` returns the real 5-hour,
   weekly, and monthly windows. The panel refreshes after each generation and every 60 seconds.
   Each response also carries `usage.opencode.allowance`, which feeds the session total.
5. **Text manipulation** — after generating, click **Edit text** to edit by hand. Select a
   passage and rewrite only that passage. The **Adjust with AI** chips rewrite the whole body
   (shorter, formal, persuasive, CTA, translation), also as a stream.
6. **Bilingual UI** — English is the default. Use the **EN/PT** button in the header to switch
   the interface; the choice is saved in `localStorage`. Presets and error messages follow the
   selected language. The output language is chosen in the brief independently.

### Suggested live-demo script

1. Open the app and show the catalog on the right: 31 models, prices, and limits. For a smoother
   live demo, use **GLM-5.3-Flash** (the default) or **Claude Haiku 5.5** — reasoning-heavy
   models can take longer to produce the first token.
2. Click **Ask for a quote** (or type your own brief), then **Generate email**. Point out the
   subject and body being written live, the caret, and the **LIVE** indicator.
3. When it finishes, show tokens, TTFT, tok/s in the email status bar and the real plan usage
   (5 hours / week / month) always visible below.
4. Click **Edit text**, select a paragraph, and rewrite just that with an instruction
   (“more direct, focus on the deadline”). Show the replacement in real time.
5. Use **Shorter** and **Translate to Portuguese** to show refinement on an existing text.
6. Open **Configure API**, paste your friend's key, and show live validation (the catalog
   reloads instantly).
7. Open **Delivery › Settings**, connect a Resend key, and show the verified domain and sender.
   Then use **Send** on the email, review the recipient, and deliver the draft for real. Show the
   Resend ID and the delivery event in history.
8. To finish, open the **Console** link in the usage bar or show
   `https://opencode.ai/console/go` with the real usage windows.

## Send with Resend

Delivery is a **provider layer** under `server/delivery/`. Resend is the first adapter; SMTP,
Amazon SES, and others can be added behind the same routes without touching the email studio.

### 1. Connect a Resend key

Get a key at <https://resend.com/api-keys> and either:

- open **Delivery › Settings** in the app, paste the key, and click **Validate and connect**; or
- put it in `.env` as `RESEND_API_KEY`.

The panel path validates the key with Resend and writes it to the local server's `.env` as
`RESEND_API_KEY`, so it survives restarts and browser tabs. If the server cannot write `.env`
(for example a read-only deployment), the key stays only in that tab's `sessionStorage` and is
forwarded in the `x-resend-key` header instead. `.env` is gitignored; never commit it.

Both key kinds work:

| Key type | What it enables |
| -------- | --------------- |
| **Full access** | Sending, domain listing, domain verification, live status refresh |
| **Sending only** | Sending, test email, and history; domains and status refresh stay hidden because Resend blocks those reads |

### 2. Verify a domain and pick a sender

Resend only delivers from a **verified domain**. Add the domain in
<https://resend.com/domains>, publish the DNS records Resend shows, then use **Sending domains ›
Verify** in the panel and refresh. `onboarding@resend.dev` works for quick tests but only reaches
the Resend account owner's address.

Under **Sender identity**, set the display name, the **From** address on the verified domain, and
an optional **Reply-To**. Suggested sender addresses are offered for every verified domain. Sender
settings persist in the browser (`localStorage`), not on the server.

### 3. Send and track

- The **Send** action on the email canvas opens **Delivery › Send** with the recipient prefilled
  from the brief when it contains an email address.
- Check **I reviewed the content** and click **Send email**. The draft subject and body are sent
  as both HTML and a plain-text alternative.
- After acceptance, the Resend email ID is shown and copied with one click. The **Settings** tab
  keeps the last sends for the session; use refresh to read the latest event (`delivered`,
  `bounced`, `complained`, `delivery_delayed`, and so on) from Resend.
- **Test email** sends a small fixed message with the current sender and key, which is useful
  before a live demo.

### Deliverability and safeguards

- Plain text is converted to simple, inline-styled HTML with **no tracking pixels, no remote
  images, and no link rewriting**, which keeps the message out of spam filters' way.
- Every message includes a plain-text part and a normal `Reply-To`, and an `Idempotency-Key`
  header prevents duplicate sends on retries.
- The **From** domain is checked against the verified domain list; a warning appears when the
  sender does not match one.
- Sends are rate limited server-side per session and IP (`RESEND_SEND_LIMIT_PER_HOUR`, default
  **20/hour**). Test sends count toward the limit.
- Provider errors are returned with a stable code, a readable message, and the raw detail under
  a collapsible **Provider details** section.

Optional `.env` defaults:

```dotenv
RESEND_API_KEY=
RESEND_FROM_NAME=PolySend
RESEND_FROM_EMAIL=hello@yourdomain.com
RESEND_REPLY_TO=you@yourdomain.com
RESEND_SEND_LIMIT_PER_HOUR=20
# Override only for local mocks/tests
RESEND_BASE_URL=https://api.resend.com
```

### Adding another provider

Create an adapter in `server/delivery/` that exposes the same operations used by
`server/delivery/resend.mjs` (validate key, list/verify domains, send, fetch status), then select
it from the delivery routes. The UI already labels the provider, so a second adapter can ship
without changing the studio itself.

## Architecture

```
src/
  App.tsx                 session state, streaming, shortcuts, connection
  components/
    Header.tsx            key status, plan, language toggle
    BriefingPanel.tsx     form + localized examples
    EmailCanvas.tsx       email paper, editing, selection, refinements
    UsageBar.tsx          real plan usage + session metrics
    ModelsPanel.tsx       live Go catalog, search, filters, plans
    MobileTabs.tsx        Briefing / Email / Models navigation on phones
    KeyModal.tsx          API configuration from the panel
    DeliveryModal.tsx     Resend key, domains, sender, test send, history
  lib/
    api.ts                fetch + SSE parser
    delivery.ts           delivery API helpers and email parsing
    i18n.tsx              English/Portuguese UI dictionaries + provider
    errors.ts             API/stream error localization by code
    presets.ts            localized briefs, tones, lengths, languages
server/
  index.mjs               Express routes, SSE, validation, delivery routes
  opencode.mjs            Go API client (models, usage, chat completions)
  prompts.mjs             generation, refinement, and selection prompts
  delivery/
    resend.mjs            Resend REST adapter, key validation, send, status
    env.mjs               persists the panel key into the server .env
    templates.mjs         plain-text to inline-styled HTML template
    store.mjs             per-session send history
```

### Backend endpoints

| Method | Route               | What it does |
| ------ | ------------------- | ------------ |
| GET    | `/api/health`       | server status, Go key presence, and Resend defaults |
| GET    | `/api/models`       | normalized Go catalog (uses `.env` or `x-opencode-key`) |
| GET    | `/api/usage`        | real Go plan usage windows |
| POST   | `/api/email/stream` | generates/refines and streams SSE (`subject`, `delta`, `usage`, `done`, `error`) |
| GET    | `/api/delivery/status` | validates the Resend key and returns domains, scopes, defaults |
| POST   | `/api/delivery/key` | validates the panel key and saves it to the server `.env` |
| POST   | `/api/delivery/domains/:id/verify` | asks Resend to re-check a domain's DNS |
| POST   | `/api/delivery/send` | sends the reviewed draft and records it in session history |
| GET    | `/api/delivery/history` | lists sends for the current session |
| GET    | `/api/delivery/history/:id` | refreshes one send's latest Resend event |

Delivery routes take the key from `x-resend-key` (panel) or `RESEND_API_KEY` (server) and the
session from `x-session-id`.

The client picks the model, brief, and mode (`generate`, `refine`, or `selection`). The backend
builds the prompts and calls
`https://opencode.ai/inference/go/openai/v1/chat/completions` with `stream: true`,
`stream_options.include_usage`, and a stable `x-opencode-session`.

### Models and reasoning

All text models work through Go's Chat Completions endpoint (Console translates when the model
speaks another API). For faster email responses, the app sends a low `reasoning_effort` when the
model declares support; models that only accept a high effort keep their default.

## A note about OpenCode Go

Go is intended for **coding-agent traffic**, and OpenCode monitors abuse that degrades the
experience for other users. This demo sends its own User-Agent and a stable
`x-opencode-session`, but email generation is not Go's primary use case. For a production
product, use **OpenCode Models pay-as-you-go** or your own provider keys. For a live demo with
friends, Go works nicely.

## API keys and security

- OpenCode and Resend keys can both live in `.env` and stay **server-side only**; they are never
  sent to the browser.
- The OpenCode panel key stays in that tab's `sessionStorage` and is sent only to your local
  backend. The Resend panel key is validated and saved to the local server's `.env`
  (`RESEND_API_KEY`) so it survives restarts; `.env` stays out of Git.
- For production, keep the keys on the server and remove the client's ability to send
  `x-opencode-key` / `x-resend-key` (or protect the app with authentication). This project is a
  local demo: do not expose the server publicly without authentication and rate limiting.
- `.env` is in `.gitignore`. Do not commit your keys. If one leaks, revoke it and create another:
  OpenCode Console under **Account › Personal API keys**, Resend under **API Keys**.

## Quick customization

- **Change the examples**: `src/lib/presets.ts`.
- **Change the UI copy / add a language**: `src/lib/i18n.tsx`.
- **Change the server prompts**: `server/prompts.mjs`.
- **Change the initial model**: `MODEL_STORAGE`/`selectedId` in `src/App.tsx`.
- **Change the colors**: CSS variables at the top of `src/styles.css`.
- **Use another default plan**: the `plan` selector in `src/App.tsx` (Go, Go Plus, Go Teams).

## Docs

- OpenCode Go: <https://opencode.ai/docs/console/go>
- Inference API: <https://opencode.ai/docs/console/api/inference>
- Model list: <https://opencode.ai/docs/console/api/models>
- Console: <https://opencode.ai/console>
- Resend API: <https://resend.com/docs/api-reference/introduction>
- Resend domains: <https://resend.com/docs/dashboard/domains/introduction>
