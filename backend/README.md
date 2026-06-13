# Task Backend

Hono + MySQL API server for the task management app.

## Setup

```bash
cp .env.example .env
docker compose up -d   # local MySQL on port 3307
npm install
npm run dev
```

Initial login password: `yukitask` (change it in Settings after logging in).

## Deploy

Deploy to Railway (provision a MySQL plugin and set the same env vars as `.env.example`).
