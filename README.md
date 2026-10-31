# TriageDesk — ML-Assisted Support Ticket Management

[![CI](https://github.com/KH-915/triagedesk/actions/workflows/ci.yml/badge.svg)](https://github.com/KH-915/triagedesk/actions/workflows/ci.yml)

## Overview

TriageDesk is a full-stack support ticket management application that helps small support teams organize incoming requests and streamline the initial triage process.

When a requester submits a ticket, a text-classification model suggests a category based on the ticket content. Support agents can review the prediction, correct the category, assign a priority, and track the ticket through its lifecycle.

The system keeps machine-generated predictions separate from human-confirmed outcomes so that model behavior can be evaluated and its limitations can be documented.

## Problem Statement

Support requests often arrive as unstructured text and require manual classification before they can be processed. TriageDesk provides a centralized workflow for submitting, organizing, classifying, and tracking these requests.

The ML component assists with categorization; it does not replace human review or automatically determine the final outcome of a ticket.

## Goals

- Provide a structured workflow for creating and managing support tickets.
- Build a responsive frontend backed by a REST API and relational database.
- Integrate a Python-based text-classification service with the application backend.
- Allow support agents to review and correct model predictions.
- Validate the system through automated tests, documented model evaluation, and reproducible deployment.

## Primary Use Cases

1. Requesters create tickets and track their own requests.
2. The system suggests a category using a text-classification model.
3. Support agents view, search, filter, and paginate the ticket queue.
4. Support agents confirm or override categories, set priorities, and update ticket status.
5. Tickets remain available for manual triage when the ML service is unavailable.

## Technical Architecture

- Frontend: React and TypeScript
- Backend: Node.js and Express
- Database: PostgreSQL
- ML service: Python, FastAPI, and scikit-learn
- Testing and delivery: automated tests, CI, Docker, and a documented deployment environment

## Design Principles

- Enforce authentication and resource authorization on the backend.
- Keep business logic, persistence, and ML inference responsibilities clearly separated.
- Validate input and handle service failures explicitly.
- Preserve both predicted and human-confirmed categories.
- Report model evaluation results only when they have been measured on a clearly defined test set.

## Scope and Limitations

TriageDesk is a portfolio project demonstrating full-stack engineering and ML service integration. The initial version focuses on ticket management and model-assisted categorization; it does not aim to provide a complete enterprise helpdesk platform or automate all support decisions.
---

## Status: MVP

Working end to end (verified locally): register/login, create ticket → ML category suggestion, agent confirms/overrides category, priority and status transitions, search/filter/pagination, role-based access (requesters see only their own tickets).

**Bulk import (agents):** the Import page (`POST /api/tickets/import`, multipart field `file`) takes a `.csv` or `.xlsx` (first sheet) with a header row: `title`, `body` (or `description`), optional `priority`. Max 1000 rows / 5 MB. It is all-or-nothing: any invalid row returns 422 with per-row errors and nothing is created. Categories come from one call to the ML service's `POST /predict/batch`; if that fails, tickets are still imported with `mlStatus = failed`.

**Not done yet:** cloud deployment, frontend tests, dashboard. The ML model is trained on a **synthetic** dataset — see [reports/model-evaluation.md](reports/model-evaluation.md); its scores are not real-world accuracy.

## Quick start

Requirements: Node 20.6+, Python 3.12, Docker (for Postgres).

```bash
powershell -ExecutionPolicy Bypass -File scripts\dev.ps1   # Windows
scripts/dev.sh                                             # Linux/macOS
```

The first run does the full setup below (creates `.env` with a random `JWT_SECRET`, installs deps, migrates, seeds, trains the model). Later runs skip anything already done and start the ML service, API and web app together; Ctrl+C stops them. Use `-Setup` / `--setup` to redo every step, and `-NoRun` / `--no-run` to set up without starting anything.

## Local setup (manual)

Requirements: Node 20.6+, Python 3.12, PostgreSQL 16 (e.g. `docker compose -f infra/docker-compose.yml up -d db`).

```bash
# 1. Config (the .env file is gitignored)
cp .env.example .env        # then set JWT_SECRET to a random 64+ char string

# 2. Node deps + database
npm install
npm run db:migrate          # applies prisma/migrations
npm --workspace=services/api run seed   # demo users: agent@triagedesk.dev / requester@triagedesk.dev

# 3. ML service
cd services/ml-api
python -m venv .venv && .venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python training/generate_data.py && python training/train.py
MODEL_VERSION=v1.0.0 uvicorn app.main:app --port 8000

# 4. In two more terminals, from the repo root
npm run dev:api             # http://localhost:4000
npm run dev:web             # http://localhost:5173
```

Demo logins (local seed only; passwords are in `services/api/src/scripts/seed.ts`). Register a new account for a requester; use the seeded agent to confirm categories.

If the ML service is down, tickets are still created with `mlStatus = failed` and can be triaged manually.

## Tests

```bash
# API (needs the TEST_DATABASE_URL database to exist and be migrated)
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy --schema=prisma/schema.prisma
TEST_DATABASE_URL=postgresql://triagedesk:triagedesk@localhost:5432/triagedesk_test npm run test:api

# ML service
cd services/ml-api && .venv/Scripts/python -m pytest

# Frontend type-check + build
npm --workspace=apps/web run build
```

## CI and Docker

`.github/workflows/ci.yml` runs on every push to `main` and every PR: API type-check + integration tests (against a Postgres service container), web type-check + build, and ML data generation + training + pytest.

`services/api/Dockerfile` and `apps/web/Dockerfile` are built from the **repo root** (`docker build -f services/api/Dockerfile .`). The API image runs `prisma migrate deploy` on start. The three images (api, web, ml-api) build locally and the API image boots against the compose Postgres; CI does not build or publish images.
