# CASPER

Centralized Automated Price Estimation for Infrastructure.

## Services
- backend: Express + TypeScript + MongoDB + Redis + BullMQ
- ml-service: FastAPI + Python NLP/ML pipeline
- frontend: React + TypeScript + Vite PWA
- extension: Chrome Extension MV3

## Quick start
1. Copy environment values in `backend/.env.development` and set secure secrets.
2. Run `docker compose up --build` from this folder.
3. Backend health: `http://localhost:4000/health`
4. ML health: `http://localhost:8000/health`

## Offline translation setup
Before running the backend, install LibreTranslate:

```bash
pip install libretranslate
# or: pip3 install libretranslate
```

First run downloads language models (~200MB). After that, translations run fully offline via local LibreTranslate.

## Security notes
- Rotate JWT secrets for each environment.
- Restrict CORS to deployed frontend domains.
- Use managed MongoDB/Redis with TLS in production.
- Run backend/frontend behind HTTPS reverse proxy.
# casper
