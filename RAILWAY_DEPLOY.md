# 🚂 Deploy Vilnius Assistant to Railway

**One-click deployment from GitHub to Railway in under 3 minutes!**

## 🚀 Quick Deploy

### Method 1: Deploy Button (Recommended)

**Step 1**: Push deployment branch to GitHub
```bash
git push origin deployment
```

**Step 2**: Click this deploy button:

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/deploy?template=https://github.com/simonaszilinskas/lizdeika/tree/deployment)

**Step 3**: Configure required environment variables in Railway dashboard:
- `OPENROUTER_API_KEY` - Your OpenRouter API key
- `MISTRAL_API_KEY` - Your Mistral API key
- `JWT_SECRET` - Generate a secure 32+ character string
- `JWT_REFRESH_SECRET` - Generate another secure 32+ character string
- `ADMIN_RECOVERY_KEY` - Generate a 24+ character string
- `CHROMA_URL` - Your ChromaDB URL (e.g., https://api.trychroma.com)
- `CHROMA_TENANT` - Your ChromaDB tenant ID
- `CHROMA_DATABASE` - Your ChromaDB database name
- `CHROMA_AUTH_TOKEN` - Your ChromaDB auth token

**Result**: Live application in 2-3 minutes with auto-generated domain!

### Method 2: Manual Railway Setup

**Step 1**: Create new Railway project
1. Go to [railway.app/new](https://railway.app/new)
2. Choose "Deploy from GitHub repo"
3. Select your `vilnius-assistant` repository
4. Choose the `deployment` branch

**Step 2**: Add PostgreSQL database
1. In Railway dashboard, click "Add Service"
2. Choose "Database" → "PostgreSQL"
3. Database URL will be auto-configured

**Step 3**: Configure environment variables
1. Go to your service → "Variables" tab
2. Add the required variables listed above
3. Railway will auto-provide: `PORT`, `DATABASE_URL`, `RAILWAY_PUBLIC_DOMAIN`

**Step 4**: Deploy
1. Railway automatically builds and deploys
2. Check "Deployments" tab for progress
3. Visit your generated URL when complete

## 🔑 Required API Keys

### OpenRouter (AI Provider)
1. Go to [openrouter.ai](https://openrouter.ai)
2. Create account and get API key
3. Set as `OPENROUTER_API_KEY`

### Mistral (Embeddings)
1. Go to [mistral.ai](https://mistral.ai)
2. Create account and get API key
3. Set as `MISTRAL_API_KEY`

### ChromaDB (Vector Database)
1. Go to [trychroma.com](https://trychroma.com)
2. Create account and get cloud instance
3. Set URL, tenant, database, and auth token

### Generate Secrets
```bash
# JWT Secret (32+ characters)
openssl rand -base64 32

# JWT Refresh Secret (32+ characters)
openssl rand -base64 32

# Admin Recovery Key (24+ characters)
openssl rand -base64 24
```

## ✅ Post-Deployment Verification

Once deployed, your app will be available at your Railway domain (e.g., `https://your-app.railway.app`).

**Test these endpoints**:
- 💚 **Health Check**: `/health` - Should return `{"status":"healthy"}`
- 🩺 **Health Dashboard**: `/health-dashboard.html` - Visual status of all services
- 👨‍💼 **Agent Dashboard**: `/agent-dashboard.html` - Main application
- ⚙️ **Admin Settings**: `/settings.html` - Configuration panel
- 🔑 **Login**: `/login.html` - User authentication

**Default admin credentials**:
- Email: `admin@vilnius.lt`
- Password: `admin123`

⚠️ **Change these immediately after first login!**

## 🔧 Configuration Options

### Optional Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LANGFUSE_PUBLIC_KEY` | - | AI monitoring (optional) |
| `LANGFUSE_SECRET_KEY` | - | AI monitoring (optional) |
| `WIDGET_PRIMARY_COLOR` | `#2c5530` | Chat widget brand color |
| `WIDGET_ALLOWED_DOMAINS` | `*` | Restrict widget embedding |
| `RAG_K` | `100` | Number of documents to retrieve |
| `LOG_LEVEL` | `info` | Logging verbosity |

### Railway Auto-Configured Variables

These are automatically set by Railway:
- `PORT` - Application port
- `DATABASE_URL` - PostgreSQL connection string
- `RAILWAY_PUBLIC_DOMAIN` - Your app's public domain
- `NODE_ENV` - Set to "production"

## 🚨 Troubleshooting

### Build Fails
- Check Railway build logs in dashboard
- Ensure all required environment variables are set
- Verify GitHub repository access

### App Won't Start
- Check deployment logs for errors
- Verify database connection (PostgreSQL addon added?)
- Ensure all API keys are valid

### Health Check Fails
- Visit `/health` endpoint directly
- Check if database migrations ran successfully
- Verify AI provider connectivity

### Database Issues
```bash
# Run in Railway shell
npx prisma migrate deploy
npx prisma db seed
```

## 🔄 Updates

To deploy updates:
1. Push changes to `deployment` branch
2. Railway automatically redeploys
3. Database migrations run automatically

## 🎯 What You Get

✅ **Auto-scaling production deployment**
✅ **Managed PostgreSQL database with backups**
✅ **SSL certificates and custom domains**
✅ **Built-in monitoring and logs**
✅ **Zero-downtime deployments**
✅ **Full Vilnius Assistant functionality**

---

🎉 **You'll have a production-ready AI customer support platform running in under 5 minutes!**
