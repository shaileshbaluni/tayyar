# Tayyar

AI mock interviews, resume builder, salary negotiator, and career tools.

## Architecture

| Service | Port (dev) | Role |
|---------|------------|------|
| **FastAPI** (`backend/`) | 8000 | Sessions, interview WebSocket, scorecard, resume/LinkedIn/salary APIs |
| **Gateway** (`server.mjs`) | 5173 | Proxies `/api/v1`, Gemini, ElevenLabs; serves production React build |
| **Vite** (`frontend/`) | 5174 | React dev UI (proxies API routes to 8000 / 5173) |

**Production:** run the API + gateway. The gateway serves `frontend/dist` when `NODE_ENV=production`.

## Quick start (development)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add GEMINI_API_KEY, etc.
python -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

Or from repo root: `npm run dev:api`

### 2. Gateway (Gemini / TTS proxies)

```bash
cp .env.example .env   # same folder as server.mjs
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend && npm install && npm run dev
```

Open **http://127.0.0.1:5174/**

## Production deploy

### Environment

**`backend/.env`** (see `backend/.env.example`):

| Variable | Required | Notes |
|----------|----------|--------|
| `ENVIRONMENT` | yes | Set to `production` |
| `GEMINI_API_KEY` | yes | Gemini + live interview |
| `CORS_ORIGINS` | yes | Comma-separated site origins, e.g. `https://app.example.com` |
| `ELEVENLABS_API_KEY` | optional | TTS |
| `ADMIN_API_KEY` | optional | Protects `/api/v1/admin/*`; set matching `VITE_ADMIN_API_KEY` in frontend build |

**Root `.env`** (gateway — see `.env.example`):

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Public HTTP port (default 5173) |
| `HOST` | `0.0.0.0` |
| `BACKEND_HOST` / `BACKEND_PORT` | FastAPI upstream |
| `GEMINI_API_KEY` | Same as backend (gateway proxies) |

### Build & run

```bash
npm install
cd frontend && npm install && cd ..
cp backend/.env.example backend/.env    # configure
cp .env.example .env                    # configure

# Terminal 1 — API
npm run start:api

# Terminal 2 — gateway (builds frontend via prestart)
# Linux/macOS:
NODE_ENV=production npm start
# Windows PowerShell:
$env:NODE_ENV="production"; npm start
```

Health checks:

- Gateway: `GET /health` (proxies backend)
- API: `GET http://127.0.0.1:8000/health`

### Docker

```bash
docker compose up --build
```

Set secrets via `backend/.env` and root `.env` before deploying.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:api` | FastAPI with reload |
| `npm run dev` | Express gateway (dev) |
| `npm run dev:vite` | Vite dev server |
| `npm run build` | Production React build |
| `npm run start:api` | FastAPI (no reload) |
| `npm start` | Build + gateway (`NODE_ENV=production`) |
| `npm run check` | CI-style frontend build |

## Repo layout

```
backend/          FastAPI application
frontend/         React + Vite UI
server.mjs        Production gateway + AI proxies
```

Removed from the repo (do not restore): duplicate `tayyar/` tree, `scratch/` scripts, legacy root Babel UI (`screens/`, `index.html`).

## Security checklist before go-live

1. Rotate any API key that ever appeared in `.env.example` or old commits.
2. Set `ENVIRONMENT=production` and explicit `CORS_ORIGINS` (no `*`).
3. Set `ADMIN_API_KEY` if exposing admin prompt catalog.
4. Use HTTPS in front of the gateway (reverse proxy / load balancer).
5. Persist `backend/storage/` on a volume or migrate to object storage for multi-instance deploys.
