# ChromaDB Migration Guide: Cloud to Local

This guide helps you migrate from ChromaDB Cloud to local ChromaDB running in Docker.

## Overview

**What's Changing**:
- **Before**: ChromaDB Cloud (external service, monthly fees)
- **After**: Local ChromaDB (Docker container, no fees)

**Benefits**:
- ✅ No cloud service costs
- ✅ Lower latency (no network hops)
- ✅ Full data control and privacy
- ✅ Same backup strategy as PostgreSQL
- ✅ Simplified deployment (one less external dependency)

**Migration Strategy**: Non-destructive with automatic re-ingestion

## Pre-Migration Checklist

Before starting the migration, verify:

1. ✅ Current ChromaDB Cloud is accessible
2. ✅ You have access to the environment variables (CHROMA_TENANT, CHROMA_API_KEY)
3. ✅ Docker and Docker Compose are installed
4. ✅ You have a backup of your current `.env` file

## Migration Steps

### Step 1: Verify Current Configuration

Check your current ChromaDB Cloud configuration:

```bash
# In custom-widget/backend/.env
echo "Current ChromaDB config:"
grep CHROMA .env
```

Expected output:
```
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name
CHROMA_API_KEY=your-api-key
```

### Step 2: Pull Latest Code

```bash
git pull origin main
```

This includes:
- Updated `docker-compose.yml` with ChromaDB service
- Updated `docker-compose.prod.yml` with ChromaDB service
- Updated `chromaService.js` with auto-detection logic
- Updated `.env.example` with new configuration

### Step 3: Stop Running Containers

```bash
docker-compose down
```

### Step 4: Update Environment Variables

**Option A: Edit .env manually**

```bash
cd custom-widget/backend
cp .env .env.backup  # Backup existing config

# Edit .env file
nano .env
```

Update ChromaDB configuration:

```bash
# Old configuration (comment out or remove)
# CHROMA_URL=https://api.trychroma.com
# CHROMA_TENANT=your-tenant-id
# CHROMA_DATABASE=your-database-name
# CHROMA_API_KEY=your-api-key

# New configuration (local mode)
CHROMA_URL=http://chroma:8000
# Note: No CHROMA_TENANT means local mode
```

**Option B: Use environment variable export**

For docker-compose, update the `.env` file in the project root:

```bash
cd /home/user/lizdeika
nano .env  # or edit docker-compose.yml directly
```

Ensure `CHROMA_URL` is not set (will use default from docker-compose.yml):
```yaml
# In docker-compose.yml backend service environment:
- CHROMA_URL=http://chroma:8000
```

### Step 5: Start Services with ChromaDB

```bash
docker-compose up --build -d
```

This will:
1. Download ChromaDB image (first time only)
2. Create `chroma_data` volume for persistence
3. Start PostgreSQL, ChromaDB, and backend services
4. Run database migrations automatically

### Step 6: Verify ChromaDB is Running

```bash
# Check all services are healthy
docker-compose ps

# Should show:
# lizdeika-chroma       running   Up 30 seconds (healthy)
# lizdeika-postgres     running   Up 45 seconds (healthy)
# lizdeika-backend      running   Up 15 seconds (healthy)

# Check ChromaDB logs
docker-compose logs chroma

# Test ChromaDB health endpoint
curl http://localhost:8000/api/v1/heartbeat
# Expected: {"nanosecond heartbeat": ...}
```

### Step 7: Verify Backend Connection

```bash
# Check backend logs for ChromaDB initialization
docker-compose logs backend | grep -i chroma

# Expected output:
# [ChromaService] initialize() called
# ChromaDB Mode: Local (HttpClient)
# Local Config: URL=http://chroma:8000
# HttpClient created successfully
# Connected to ChromaDB (local mode) - Collection: lizdeika-collection-2025
```

### Step 8: Re-ingest Documents

You need to re-ingest all documents from your knowledge base. The smart ingestion API will handle deduplication automatically.

**Option A: Via API (Recommended)**

If you have documents stored elsewhere (file system, database):

```bash
# Example: Ingest documents via API
curl -X POST http://localhost:3002/api/knowledge/documents/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "documents": [
      {
        "body": "Document content here",
        "title": "Document Title",
        "sourceUrl": "https://source.example.com/doc1"
      }
    ]
  }'
```

**Option B: Via Settings UI**

1. Navigate to: `http://localhost:3002/settings.html`
2. Login as admin (`admin@lizdeika.lt` / `admin123`)
3. Go to "Knowledge Management" section
4. Upload documents (.txt or .docx files)
5. System will automatically:
   - Generate SHA256 hash
   - Check for duplicates
   - Create embeddings with Mistral
   - Store in local ChromaDB

**Option C: Bulk Re-ingestion Script**

If you have many documents, create a script:

```javascript
// reingest-documents.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const BACKEND_URL = 'http://localhost:3002';
const AUTH_TOKEN = 'YOUR_JWT_TOKEN';
const DOCUMENTS_DIR = './knowledge-base-docs';

async function reingestDocuments() {
  const files = fs.readdirSync(DOCUMENTS_DIR);

  for (const file of files) {
    if (file.endsWith('.txt') || file.endsWith('.md')) {
      const content = fs.readFileSync(
        path.join(DOCUMENTS_DIR, file),
        'utf-8'
      );

      await axios.post(
        `${BACKEND_URL}/api/knowledge/documents/ingest`,
        {
          documents: [{
            body: content,
            title: file.replace(/\.(txt|md)$/, ''),
            sourceType: 'manual_upload'
          }]
        },
        {
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` }
        }
      );

      console.log(`✓ Ingested: ${file}`);
    }
  }
}

reingestDocuments();
```

Run it:
```bash
cd custom-widget/backend
node reingest-documents.js
```

### Step 9: Verify Vector Search Works

Test that semantic search is working:

```bash
# Via API (as admin)
curl -X GET "http://localhost:3002/api/knowledge/documents" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return list of ingested documents with metadata
```

Or via the agent dashboard:
1. Login as agent or admin
2. Open a conversation
3. Send a message that should trigger RAG search
4. Check logs for vector search activity:

```bash
docker-compose logs backend | grep "ChromaDB Vector Search"
```

### Step 10: Production Deployment

For production, use `docker-compose.prod.yml`:

```bash
# Update production .env
cd /home/user/lizdeika
nano .env

# Ensure these are set:
CHROMA_URL=http://chroma:8000
MISTRAL_API_KEY=your-real-mistral-key
# No CHROMA_TENANT for local mode

# Deploy to production
docker-compose -f docker-compose.prod.yml up --build -d

# Verify
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs chroma
```

## Rollback Plan

If you need to rollback to ChromaDB Cloud:

```bash
# Step 1: Stop containers
docker-compose down

# Step 2: Restore old .env
cd custom-widget/backend
cp .env.backup .env

# Step 3: Restart with cloud config
docker-compose up --build -d

# Note: Your cloud data is unchanged, so no data loss
```

## Backup Strategy

### Automated Daily Backups

Add to cron (production):

```bash
# Edit crontab
crontab -e

# Add this line for daily 2 AM backups:
0 2 * * * docker run --rm -v chroma_prod_data:/data -v /backups:/backup alpine tar czf /backup/chroma_backup_$(date +\%Y\%m\%d).tar.gz -C /data .
```

### Manual Backup

```bash
# Development
docker run --rm -v chroma_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/chroma_backup_$(date +%Y%m%d).tar.gz -C /data .

# Production
docker run --rm -v chroma_prod_data:/data -v /backups:/backup \
  alpine tar czf /backup/chroma_prod_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore from Backup

```bash
# Stop services
docker-compose down

# Remove old volume
docker volume rm chroma_data

# Create new volume
docker volume create chroma_data

# Restore data
docker run --rm -v chroma_data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/chroma_backup_YYYYMMDD.tar.gz -C /data

# Restart services
docker-compose up -d
```

## Troubleshooting

### ChromaDB Container Won't Start

**Symptom**: `docker-compose ps` shows chroma as "unhealthy" or "restarting"

**Solution**:
```bash
# Check logs
docker-compose logs chroma

# Common issue: Port 8000 already in use
sudo lsof -i :8000
# Kill conflicting process or change port in docker-compose.yml

# Restart
docker-compose restart chroma
```

### Backend Can't Connect to ChromaDB

**Symptom**: Backend logs show "Failed to initialize Chroma DB"

**Solution**:
```bash
# Verify network connectivity
docker-compose exec backend ping chroma

# If ping fails, check network configuration
docker network inspect lizdeika-network

# Restart both services
docker-compose restart chroma backend
```

### Documents Not Appearing in Search

**Symptom**: Ingestion succeeds but search returns no results

**Possible Causes**:
1. **Mistral API key invalid**:
   ```bash
   # Check backend logs
   docker-compose logs backend | grep -i mistral
   ```

2. **Embeddings not generated**:
   ```bash
   # Check ingestion response
   curl -X GET http://localhost:3002/api/knowledge/documents \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   # Verify chroma_ids array is populated
   ```

3. **Collection mismatch**:
   ```bash
   # Check collection name in logs
   docker-compose logs backend | grep "Collection:"
   # Should be: lizdeika-collection-2025
   ```

### High Memory Usage

**Symptom**: ChromaDB container using excessive memory

**Solution**:
```bash
# Check resource usage
docker stats lizdeika-chroma

# If needed, add memory limits to docker-compose.yml:
# services:
#   chroma:
#     deploy:
#       resources:
#         limits:
#           memory: 512M
```

## Performance Comparison

| Metric | ChromaDB Cloud | Local ChromaDB |
|--------|---------------|----------------|
| Query Latency | 100-300ms | 20-50ms |
| Embedding Time | ~200ms | ~200ms (Mistral API) |
| Data Privacy | Cloud | Local |
| Monthly Cost | $30-100 | $0 |
| Scalability | Horizontal | Vertical |
| Backup | Provider | Self-managed |

## Post-Migration Checklist

After migration is complete:

- [ ] All services running healthy (`docker-compose ps`)
- [ ] ChromaDB accessible (`curl http://localhost:8000/api/v1/heartbeat`)
- [ ] Backend connected to ChromaDB (check logs)
- [ ] Documents re-ingested successfully
- [ ] Vector search working in agent dashboard
- [ ] Backup schedule configured (production)
- [ ] Old ChromaDB Cloud subscription canceled (if not needed)
- [ ] `.env.backup` file stored securely

## Support

If you encounter issues during migration:

1. Check the troubleshooting section above
2. Review `CLAUDE.md` ChromaDB Configuration section
3. Examine logs: `docker-compose logs backend chroma`
4. Verify environment variables: `docker-compose config`
5. Test with curl commands to isolate the issue

## Appendix: Environment Variable Reference

### Local Mode (Default)
```bash
CHROMA_URL=http://chroma:8000
MISTRAL_API_KEY=your-mistral-api-key
# No CHROMA_TENANT, CHROMA_DATABASE, or CHROMA_API_KEY
```

### Cloud Mode (Backward Compatible)
```bash
CHROMA_URL=https://api.trychroma.com
CHROMA_TENANT=your-tenant-id
CHROMA_DATABASE=your-database-name
CHROMA_API_KEY=your-chroma-cloud-key
MISTRAL_API_KEY=your-mistral-api-key
```

### Test Mode
```bash
CHROMA_URL=http://localhost:8000
# Tests use local ChromaDB or gracefully degrade if unavailable
```

---

**Migration Completed?** 🎉

Your Lizdeika installation now runs ChromaDB locally with no external dependencies!
