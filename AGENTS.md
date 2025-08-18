# Repository Guidelines

## Project Structure & Module Organization
- `custom-widget/backend/`: Node.js API + WebSocket server. Source in `src/{controllers,routes,services,utils}`; tests in `tests/{unit,integration}`; config via `.env` (see `.env.example`).
- `custom-widget/*.html`: UI pages (e.g., `agent-dashboard.html`, `embed-widget.html`, `test-dashboard.html`, `admin*.html`).
- `project/`: Technical docs (overview, migration plans, specifications).
- Root: `server.js` (serves static UI), `chat.html`, `.env`, `start_server.sh`, minimal `package.json` for hosting.

## Build, Test, and Development Commands
- Install backend deps: `cd custom-widget/backend && npm install`.
- Run backend (dev): `npm run dev` (nodemon; port `WIDGET_BACKEND_PORT` or `3002`).
- Run backend (prod): `npm start`.
- Serve static UI (root): `npm run dev` (hosts UI at `http://localhost:3000`).
- Tests (backend): `npm test`, `npm run test:watch`, `npm run test:coverage`.

## Coding Style & Naming Conventions
- JavaScript (Node 18+): 2‑space indentation, semicolons, single quotes.
- Filenames: backend `*.js` use camelCase (e.g., `conversationService.js`); HTML/assets use kebab-case (e.g., `agent-dashboard.html`).
- Structure: keep controllers thin, put logic in services, routes map endpoints.
- Linting: no linter configured; format consistently via your editor/Prettier (if installed locally).

## Testing Guidelines
- Framework: Jest. Tests live in `custom-widget/backend/tests/{unit,integration}` and use `*.test.js` naming.
- Coverage: `npm run test:coverage`. Prioritize services and route behavior; include error paths and edge cases.
- Integration: ensure backend `.env` is set; tests exercise `/health`, conversation endpoints, and WebSocket events.

## Commit & Pull Request Guidelines
- Commits: short, imperative subjects; optional emoji/type prefix (e.g., `🔧 Fix settings save logic`). Keep changes atomic.
- PRs: clear description, linked issues, screenshots/GIFs for UI changes, test steps/results, and any config/migration notes.

## Security & Configuration Tips
- Do not commit secrets. Copy `.env.example` to `.env` (root and backend): `cp custom-widget/backend/.env.example custom-widget/backend/.env`.
- Key vars: `AI_PROVIDER`, `FLOWISE_URL`, `FLOWISE_CHATFLOW_ID`, `OPENROUTER_API_KEY`, `WIDGET_BACKEND_PORT`/`PORT`.
- Default ports: UI host `3000` (root), backend `3002`.

