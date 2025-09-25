# Custom Widget Test Suites

This directory houses legacy widget and dashboard tests that exercise the raw browser bundles. The root-level `tests/` folder contains the newer Jest suites that run against the modularised code.

When adding coverage:
- Use `tests/` for modern unit/integration specs (JSDOM-based).
- Use `custom-widget/tests/frontend` only for end-to-end smoke tests that rely on the bundled HTML demo pages.

The long-term plan is to consolidate on the root `tests/` tree once the remaining legacy specs are ported.
