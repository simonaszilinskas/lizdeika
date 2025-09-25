# Repository Guidelines

## Project Structure & Module Organization
Keep frontend code inside `custom-widget/js/`, grouping widgets, agent dashboard screens, and shared helpers by feature. Backend logic lives in `custom-widget/backend/src/` with Express controllers, services, routes, middleware, and utilities; Prisma schema and migrations sit in `custom-widget/backend/prisma/`. Place shared fixtures and baselines under `tests/`, while API-only suites belong in `custom-widget/backend/tests/`. Deployment and operational assets reside in `scripts/` and `docker/`; update paired READMEs or inline comments whenever behavior changes.

## Build, Test, and Development Commands
Use `docker-compose up --build` to spin up the full stack for validation. For backend-only work, run `cd custom-widget/backend && npm install && npm run dev` to start Nodemon with hot reloads; follow Prisma edits with `npm run db:push`. Run `npm run test` for unit checks, `npm run test:visual` for regression baselines, `npm run test:performance` for benchmarks, and `npm run test:all` before merging UI-heavy work.

## Coding Style & Naming Conventions
JavaScript files use 4-space indentation, trailing semicolons, and concise top-of-file module comments. Stick to `camelCase` for variables and functions, `PascalCase` for classes and components, and hyphenated filenames for HTML assets such as `agent-dashboard.html`. Frontend modules export ES modules, while backend files stay on CommonJS—keep each layer consistent to avoid bundler issues. Run your configured Prettier profile before committing.

## Testing Guidelines
Jest autodiscovers `*.test.js`; place new suites in `tests/<type>/` or `custom-widget/backend/tests/<type>/` and reuse helpers from `tests/utilities/`. Share global hooks via `tests/setup.js` and extend mocks in `tests/mocks/` rather than re-creating fixtures. Maintain coverage parity with existing reports using `npm run test:coverage` at the repo root or within `custom-widget/backend`.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat:`, `fix:`, `docs:`) with concise, imperative summaries. Reference Jira or GitHub issues in the body when applicable and highlight schema or environment changes explicitly. Pull requests should list validation commands, attach UI screenshots for visual updates, and document rollout or migration steps so reviewers can assess risk.

## Security & Configuration Tips
Create local `.env` files from `.env.template`; never commit secrets, API keys, or database URLs. Generate Prisma migrations with `npm run db:migrate` and commit both the migration files and schema updates. Logs under `custom-widget/backend/logs/` are developer-only—sanitize sensitive payloads before sharing excerpts externally.
