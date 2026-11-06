/**
 * FidesOrigin API Service Boundary
 *
 * Architecture Decision: apps/api/ → lightweight proxy → backend/
 *
 * ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
 * │   Client    │────▶│  apps/api/   │────▶│  backend/       │
 * │  (Browser)  │     │  (Vercel)    │     │  (FastAPI)      │
 * └─────────────┘     └──────────────┘     └─────────────────┘
 *                         Proxy only         Business Logic
 *
 * Rules:
 * 1. apps/api/ MUST NOT contain business logic
 * 2. apps/api/ MUST NOT maintain in-memory state
 * 3. apps/api/ SHOULD only do: auth, validation, rate-limit, proxy
 * 4. All business logic lives in backend/ Python services
 *
 * Migration Status:
 * - [DONE] /v1/risk/check       → proxy to /api/v1/address/{address}/risk
 * - [DONE] /v1/risk/batch-check → proxy to /api/v1/address/batch-check
 * - [DONE] /v1/risk/address/:id → proxy to /api/v1/address/{address}/risk
 * - [DONE] /v1/dashboard/stats  → proxy to /api/v1/dashboard/summary
 * - [DONE] /v1/rules            → proxy to /api/v1/rules + PostgreSQL
 * - [DONE] /v1/rules/[id]       → proxy to /api/v1/rules/{id} + PostgreSQL
 *
 * Backend Base URL: Set BACKEND_API_URL env var (default: http://localhost:8000)
 */

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:8000';

module.exports = { BACKEND_API_URL };
