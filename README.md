# LongCat AI Studio — v1.0

Mobile-first PWA + Node.js backend for an AI coding assistant and agent-planning workspace.

## What is included

- Responsive dark premium LongCat UI
- Assistant mode and Agent Planning mode
- OpenAI provider integration using Chat Completions API
- Configurable LongCat OpenAI-compatible provider
- Server-side API key handling (keys are never sent to the browser)
- Basic rate limiting, Helmet security headers, JSON size limit
- Health endpoint at `/api/health`
- PWA manifest and service worker
- Optional Firebase Admin initialization hook

## Important scope limits

This is a working AI chat / coding-assistant foundation, not yet a fully autonomous coding runtime. The Agent mode currently plans work and generates instructions/code in chat. It does not have a secure filesystem workspace, terminal, code execution sandbox, GitHub write access, automatic tests, or deployment automation yet. Those require a separate sandboxed worker and explicit permissions. Do not expose a general shell on the public web server.

Chat history is currently held in browser memory for the current page session; it is not persisted to Firebase.

LongCat provider support requires an OpenAI-compatible Chat Completions endpoint. Set the exact base URL and model name documented by your LongCat API account. Do not guess the endpoint.

Firebase is optional in this first deployment. The server can initialize Firebase Admin when a valid service-account JSON is supplied, but this starter does not yet store user accounts or chat history in Firestore.

## Deploy to Render

1. Upload this project to a GitHub repository.
2. In Render, choose **New → Blueprint** and connect that repository, or create a Node Web Service.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables in Render → your service → Environment:
   - `OPENAI_API_KEY` — your new OpenAI API key
   - `OPENAI_MODEL` — e.g. `gpt-4.1-mini` if available to your API account
   - `LONGCAT_API_KEY` — your LongCat API key
   - `LONGCAT_BASE_URL` — exact OpenAI-compatible API base URL from LongCat documentation
   - `LONGCAT_MODEL` — exact model ID from LongCat documentation
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — optional, one-line service-account JSON
6. Deploy. Open `https://YOUR-SERVICE.onrender.com/api/health`.
7. Open the service URL on Android Chrome. Use Chrome menu → Install app / Add to Home screen.

## Security

- Never put API keys in `public/`, HTML, CSS, browser JavaScript, or GitHub commits.
- If a key was committed to a public or shared repository, revoke it and create a replacement. Removing it from the latest commit is not sufficient because Git history may retain it.
- Store secrets only in Render Environment Variables.
- Do not paste a Firebase service-account private key into GitHub. If used, put the complete JSON in Render Environment Variables.
- Restrict access and usage limits in provider dashboards where available.

## Local run

Requires Node.js 20+.

```bash
npm install
cp .env.example .env
# Add credentials to .env locally; never commit .env
npm start
```

Open `http://localhost:3000`.
