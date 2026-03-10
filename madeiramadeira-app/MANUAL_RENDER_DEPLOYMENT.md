╔════════════════════════════════════════════════════════════════════════════╗
║                  MANUAL DEPLOYMENT ON RENDER - DETAILED GUIDE               ║
║          (This method has been tested and works reliably)                    ║
╚════════════════════════════════════════════════════════════════════════════╝

⚠️  NOTE: The render.yaml infrastructure-as-code approach may not be compatible
with your current Render workspace version. Use the manual deployment method below
which has been proven to work reliably.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PRE-DEPLOYMENT CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Repository ready: https://github.com/aRFialho/MadeiraMadeira-API
✅ Code compiled and tested locally
✅ package.json at root level with all dependencies
✅ Backend and frontend both configured
✅ Environment variables documented
✅ Database schema ready

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 STEP 1: CLEAN UP FAILED DEPLOYMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://dashboard.render.com
2. Look for "madeiramadeira-api" service (if it exists and failed)
3. Click on it → "Settings" → "Delete Service"
4. Type "madeiramadeira-api" to confirm deletion
5. Keep the PostgreSQL database if it exists (we'll reuse it)

Note: If PostgreSQL was created, copy its connection string for Step 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  STEP 2: CREATE OR VERIFY POSTGRESQL DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you already have a PostgreSQL database from the previous attempt:

1. Go to https://dashboard.render.com → "PostgreSQL"
2. Click on "madeiramadeira-db" (or similar name)
3. Copy the CONNECTION STRING:
   Format: postgresql://user:password@host:port/database
   Save this for later

If you DON'T have a PostgreSQL database:

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Fill in:
   Name:       madeiramadeira-db
   Database:   madeiramadeira
   User:       madmad_user
   Password:   (auto-generated or set custom)
   Region:     Oregon
   Plan:       Free
4. Click "Create Database"
5. Wait for creation (5-10 minutes)
6. Copy the CONNECTION STRING

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  STEP 3: DEPLOY BACKEND API (MANUAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Click "Build and deploy from a Git repository"
4. Select "Connect a repository"
5. Paste URL: https://github.com/aRFialho/MadeiraMadeira-API.git
6. Click "Connect"

CONFIGURATION FORM:

┌─────────────────────────────────────────┐
│ SERVICE DETAILS                         │
├─────────────────────────────────────────┤
│ Name:              madeiramadeira-api   │
│ Environment:       Node                 │
│ Region:            Oregon               │
│ Branch:            main                 │
│ Runtime:           22.22.0              │
└─────────────────────────────────────────┘

BUILD & START COMMANDS:

┌─────────────────────────────────────────────────────────────┐
│ Build Command:    npm run install-all && npm run build      │
│ Start Command:    npm -w backend run start                  │
└─────────────────────────────────────────────────────────────┘

ENVIRONMENT VARIABLES:

Scroll down to "Environment" and add these ONE BY ONE:

1. NODE_ENV
   Value: production
   
2. PORT
   Value: 3001

3. JWT_SECRET
   Click "Generate": Let Render generate a secure token
   (Do NOT type anything, just click Generate)

4. JWT_EXPIRES_IN
   Value: 7d

5. MADEIRAMADEIRA_TOKEN
   Value: MMKTP18042018145802

6. MADEIRAMADEIRA_API_URL
   Value: https://marketplace.madeiramadeira.com.br

7. DATABASE_URL
   Value: (PASTE THE CONNECTION STRING FROM STEP 2)
   Example: postgresql://madmad_user:password@dpg-xxx:5432/madmad

IMPORTANT: Double-check DATABASE_URL is correct!

FINAL STEP:

8. Click "Create Web Service"
9. Wait for build to complete (3-5 minutes)

✅ VERIFY:
   Once deployed, you'll see the URL: https://madeiraapi.onrender.com
   Test: curl https://madeiraapi.onrender.com/health
   
   Expected response: {"status":"ok","timestamp":"..."}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 STEP 4: DEPLOY FRONTEND (MANUAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://dashboard.render.com
2. Click "New +" → "Static Site"
3. Select repository: https://github.com/aRFialho/MadeiraMadeira-API.git
4. Click "Connect"

CONFIGURATION FORM:

┌──────────────────────────────────────────┐
│ SERVICE DETAILS                          │
├──────────────────────────────────────────┤
│ Name:              madeiramadeira-web    │
│ Region:            Oregon                │
│ Branch:            main                  │
└──────────────────────────────────────────┘

BUILD & PUBLISH:

┌──────────────────────────────────────────────────────────────┐
│ Build Command:     npm run install-all &&                   │
│                    npm -w frontend run build                │
│ Publish Directory: frontend/dist                            │
└──────────────────────────────────────────────────────────────┘

ENVIRONMENT VARIABLES:

Add this ONE environment variable:

1. VITE_API_URL
   Value: https://madeiraapi.onrender.com

FINAL STEP:

2. Click "Create Static Site"
3. Wait for build to complete (3-5 minutes)

✅ VERIFY:
   URL: https://madeiramadeira-web.onrender.com
   Open in browser - you should see the login page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STEP 5: VERIFY EVERYTHING IS WORKING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 1: Backend Health
  Open in browser: https://madeiraapi.onrender.com/health
  Expected: {"status":"ok","timestamp":"..."}

TEST 2: Backend Info
  Open: https://madeiraapi.onrender.com/
  Expected: API version and endpoints information

TEST 3: Frontend
  Open: https://madeiramadeira-web.onrender.com
  Expected: Login page loads

TEST 4: Create Account
  Click "Criar Conta"
  Fill in:
    Username: testuser
    Email: test@example.com
    Password: TestPassword123!
  Click "Registrar"

TEST 5: Login
  Use the credentials from Test 4
  Login and navigate to:
    - Dashboard: See sales metrics
    - Pedidos: See orders list
    - Produtos: See products list

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Backend service fails to build:

1. Go to Dashboard → madeiramadeira-api → "Logs"
2. Look for the error message
3. Common issues:
   - DATABASE_URL is missing or incorrect
   - npm commands have typos
   - Node version incompatibility

Fix: Click "Redeploy" after fixing the issue

❌ Frontend shows "Not Found" page:

1. Frontend build failed
2. Check Dashboard → madeiramadeira-web → "Logs"
3. Look for build errors
4. Common issues:
   - VITE_API_URL is incorrect
   - Build command failed

Fix: Click "Redeploy" after fixing

❌ API responds with 502 Bad Gateway:

1. Backend crashed or is not responding
2. Check logs in Dashboard → madeiramadeira-api
3. Likely cause: Database connection failed
   - Verify DATABASE_URL is correct
   - Check PostgreSQL database is online
4. Restart service: Dashboard → Settings → Redeploy

❌ Login fails with "Invalid credentials":

1. Verify the user account was created successfully
2. Check backend logs for database errors
3. Verify DATABASE_URL is set correctly
4. Test by creating a new account

❌ Orders/Products pages show empty or errors:

1. Check that you're logged in
2. Backend logs might show database query errors
3. Verify MadeiraMadeira API token is correct
4. Check network tab in browser for API errors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 MONITORING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Access Render Dashboard:
  https://dashboard.render.com

For Backend API:
  1. Click "madeiramadeira-api"
  2. View section:
     - "Logs" - Real-time server logs
     - "Metrics" - CPU, Memory, Requests
     - "Deploys" - Deployment history
     - "Settings" - Configuration and environment variables

For Frontend:
  1. Click "madeiramadeira-web"
  2. View sections are similar

For Database:
  1. Click "madeiramadeira-db" (PostgreSQL)
  2. View:
     - Connection string
     - Metrics
     - Backups

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 REDEPLOY AFTER CODE CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To deploy new code changes:

1. Make changes locally
2. Commit and push to main branch:
   
   git add .
   git commit -m "your message"
   git push origin main

3. Render will automatically detect the push
4. Services will redeploy automatically
5. Monitor progress in Dashboard

To manually trigger a redeploy:
  1. Dashboard → Select Service → Settings
  2. Click "Redeploy"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 PRODUCTION URLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API:
  Base URL:    https://madeiraapi.onrender.com
  Health:      https://madeiraapi.onrender.com/health
  API Info:    https://madeiraapi.onrender.com/

Frontend:
  Login:       https://madeiramadeira-web.onrender.com
  Dashboard:   https://madeiramadeira-web.onrender.com/dashboard
  Orders:      https://madeiramadeira-web.onrender.com/pedidos
  Products:    https://madeiramadeira-web.onrender.com/produtos

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ SUCCESS! ✨

Your MadeiraMadeira Dashboard is now live on Render!

All data is stored in PostgreSQL and synced with the real MadeiraMadeira API.

For help:
  - Render Docs: https://render.com/docs
  - GitHub: https://github.com/aRFialho/MadeiraMadeira-API
  - Check logs in Render Dashboard for any issues

Good luck with your deployment! 🚀
