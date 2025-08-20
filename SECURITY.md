# Security

Do not commit secrets. Use `.env` files locally. Rotate keys if leaked.

- Auth: basic agent auth in backend. No public API keys in frontend.
- CORS: allow only required origins for production.
- Rate limiting: add before going public.
- Data: keep messages max 6 months (planned). No PII in logs.
- Dependencies: keep Node 18+, update regularly.

Report issues privately. Describe impact and steps to reproduce.
