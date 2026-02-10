# GitHub Copilot / AI Agent Instructions for Project WCT

Purpose: Enable AI coding agents to be productive in this repo by providing concise, actionable, and project-specific guidance.

## Big Picture Architecture
- **Monorepo with two main apps:**
  - `backend/`: Node.js + Express server (entry: `server.js`). Handles API, Supabase auth, and data access. Uses both Supabase SDK (Postgres) and some Mongoose-style patterns (see below).
  - `student-hub/`: Vite + React + TypeScript frontend. Uses shadcn/ui, Tailwind, and path alias `@/*` for `src/*`.
- **Data & Auth:** Supabase is the source of truth for authentication and most tables (profiles, classes, quizzes, assignments). Backend uses the Supabase service role key for privileged operations; frontend uses anon key via `.env`.

## Developer Workflows
- **Backend:**
  - `cd backend && npm install`
  - `npm run dev` (nodemon, default port 5000)
- **Frontend:**
  - `cd student-hub && npm install`
  - `npm run dev` (Vite, default port 3000)
- **Environment:**
  - Backend: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `PORT`
  - Frontend: `student-hub/.env` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Debugging:**
  - Backend: See `config/supabase.js` for key selection and logs
  - Frontend: `src/supabaseClient.ts` logs missing env keys
  - Auth tokens are stored in localStorage as `token` and sent as `Authorization: Bearer <token>`

## Project-Specific Conventions & Patterns
- **Frontend:**
  - Path alias: `@/*` → `src/*` (see `tsconfig.json`)
  - UI: shadcn/ui components in `src/components/ui/*`
  - Auth: `AuthContext` manages Supabase session and calls backend `/api/auth/register` for profile creation
- **Backend:**
  - Supabase client is centralized in `config/supabase.js` (prefers service role key)
  - Auth middleware: `middleware/supabaseAuth.js` validates JWT tokens via `supabase.auth.getUser(token)`
  - File uploads: `uploads/assignments/` via `multer` (10MB limit, extension whitelist)
  - Some models (e.g., `models/Class.js`) are actually Express routers using Supabase, not Mongoose models—watch for this hybrid pattern

## Integration Points & Examples
- **Register flow:**
  - Frontend calls `POST /api/auth/register` (see `AuthContext.register`)
  - Backend inserts into `profiles` using service role key
  - Dev helper: `POST /api/admin/bootstrap-admin` (see README for usage and env requirements)
- **API client:**
  - `src/services/api.ts` configures axios with `baseURL: http://localhost:5000/api` and attaches `Authorization` from localStorage
- **Login:** Returns `{ token, data: { user } }`; use `Authorization: Bearer <token>` for all API calls

## Non-Standard or Caution Areas
- **Mixed data access:** Some files use Supabase (SQL), others expect Mongoose models. E.g., `models/Class.js` is an Express router, not a Mongoose model. Avoid refactoring data layer without human review.
- **Missing imports:** E.g., `routes/assignments.js` references `Assignment` but may lack `require('../models/Assignment')` at top-level—add as needed.
- **Role logic:** `routes/auth.js` restricts roles to `student`/`employer`, but frontend offers more. Be careful updating registration/role logic.
- **No automated tests** or test scripts in `package.json`.

## Key Files & Starting Points
- `backend/server.js`: main server and route mounting
- `backend/config/supabase.js`: Supabase client/key logic
- `backend/middleware/supabaseAuth.js`: token validation
- `student-hub/src/context/AuthContext.tsx`: frontend auth flows
- `student-hub/src/services/api.ts`: axios config/interceptors
- `student-hub/src/pages/Register.tsx`: error handling/UX

---
If any section is unclear or incomplete, or you need more examples (e.g., curl/API usage, PR templates), specify which part to expand or clarify.