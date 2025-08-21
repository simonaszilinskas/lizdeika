const path = require('path');
const fs = require('fs');
const express = require('express');

function createDocsRoutes() {
  const router = express.Router();

  // Serve the raw OpenAPI YAML
  router.get('/openapi.yaml', (req, res) => {
    const specPath = path.join(__dirname, '../../openapi.yaml');
    if (!fs.existsSync(specPath)) return res.status(404).send('Spec not found');
    res.type('text/yaml');
    fs.createReadStream(specPath).pipe(res);
  });

  // Minimal HTML with a link to the YAML and instructions
  router.get('/', (req, res) => {
    res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>API Docs</title>
<style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif;max-width:720px;margin:40px auto;padding:0 16px;}</style>
</head><body>
<h1>API Docs</h1>
<p>OpenAPI YAML: <a href="/docs/openapi.yaml">/docs/openapi.yaml</a></p>
<p>To view with Swagger UI locally, install <code>swagger-ui-express</code> and wire it to this spec.</p>
</body></html>`);
  });

  return router;
}

module.exports = createDocsRoutes;

