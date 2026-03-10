╔════════════════════════════════════════════════════════════════════════════╗
║                  RENDER DEPLOYMENT - STEP BY STEP GUIDE                    ║
║                  MadeiraMadeira Dashboard API & Frontend                    ║
╚════════════════════════════════════════════════════════════════════════════╝

🚀 DEPLOYMENT URLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backend API:   https://madeiraapi.onrender.com
Frontend Web:  https://madeiramadeira-web.onrender.com
GitHub Repo:   https://github.com/aRFialho/MadeiraMadeira-API
Database:      PostgreSQL on Render (Oregon)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 PRE-DEPLOYMENT CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Git repository pushed to GitHub
✅ Code compiled and tested locally
✅ render.yaml configured with all services
✅ Environment variables prepared
✅ Database schema ready
✅ API client configured for VITE_API_URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 STEP 1: ACCESS RENDER DASHBOARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://dashboard.render.com
2. Sign in or create an account
3. Click "New +" button (top right)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🗄️  STEP 2: CREATE POSTGRESQL DATABASE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "New +" → "PostgreSQL"
2. Fill in the form:
   
   Name:        madeiramadeira-db
   Database:    madeiramadeira
   User:        madmad_user
   Region:      Oregon
   PostgreSQL Version: 15
   Plan:        Free (or Standard if needed)

3. Click "Create Database"
4. Wait for creation (5-10 minutes)
5. Copy the Database URL (CONNECTION STRING)
   - Format: postgresql://user:password@host:5432/database
   - You'll need this for the Backend service environment variables

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚙️  STEP 3: CREATE BACKEND API SERVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "New +" → "Web Service"
2. Select "Connect a repository"
3. Choose: https://github.com/aRFialho/MadeiraMadeira-API.git
4. Fill in the form:

   ┌─────────────────────────────────────────┐
   │ BACKEND SERVICE CONFIGURATION           │
   ├─────────────────────────────────────────┤
   │ Name:              madeiramadeira-api   │
   │ Environment:       Node                 │
   │ Region:            Oregon               │
   │ Branch:            main                 │
   │ Build Command:     npm install-all &&   │
   │                    npm run build        │
   │ Start Command:     npm -w backend run   │
   │                    start                │
   └─────────────────────────────────────────┘

5. Scroll down to "Environment" section
6. Add these environment variables:

   ┌─────────────────────────────────────────────────────────────┐
   │ NODE_ENV                                                    │
   │ Value: production                                           │
   ├─────────────────────────────────────────────────────────────┤
   │ PORT                                                        │
   │ Value: 3001                                                │
   ├─────────────────────────────────────────────────────────────┤
   │ JWT_SECRET                                                  │
   │ (Keep empty - Render will auto-generate)                   │
   ├─────────────────────────────────────────────────────────────┤
   │ JWT_EXPIRES_IN                                              │
   │ Value: 7d                                                  │
   ├─────────────────────────────────────────────────────────────┤
   │ MADEIRAMADEIRA_TOKEN                                        │
   │ Value: MMKTP18042018145802                                 │
   ├─────────────────────────────────────────────────────────────┤
   │ MADEIRAMADEIRA_API_URL                                      │
   │ Value: https://marketplace.madeiramadeira.com.br          │
   ├─────────────────────────────────────────────────────────────┤
   │ DATABASE_URL                                                │
   │ Value: (Paste the PostgreSQL connection string from Step 2)│
   └─────────────────────────────────────────────────────────────┘

7. Click "Create Web Service"
8. Wait for deployment (3-5 minutes)
9. Once deployed, you'll see the URL: https://madeiraapi.onrender.com

✅ Verify:
   curl https://madeiraapi.onrender.com/health
   
   Expected response:
   {"status":"ok","timestamp":"2026-03-10T...","version":"1.0.0"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎨 STEP 4: CREATE FRONTEND STATIC SITE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "New +" → "Static Site"
2. Select repository: https://github.com/aRFialho/MadeiraMadeira-API.git
3. Fill in the form:

   ┌──────────────────────────────────────────┐
   │ FRONTEND SERVICE CONFIGURATION           │
   ├──────────────────────────────────────────┤
   │ Name:              madeiramadeira-web    │
   │ Environment:       Node                  │
   │ Region:            Oregon                │
   │ Branch:            main                  │
   │ Build Command:     npm install-all &&    │
   │                    npm -w frontend build │
   │ Publish Directory: frontend/dist         │
   └──────────────────────────────────────────┘

4. Add environment variable:
   
   VITE_API_URL = https://madeiraapi.onrender.com

5. Click "Create Static Site"
6. Wait for deployment (3-5 minutes)
7. Once deployed, you'll get URL: https://madeiramadeira-web.onrender.com

✅ Verify:
   Open https://madeiramadeira-web.onrender.com in browser
   You should see the login page

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ STEP 5: VERIFY DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

API Health Check:
  curl https://madeiraapi.onrender.com/health

API Info:
  curl https://madeiraapi.onrender.com/

Frontend:
  https://madeiramadeira-web.onrender.com

All should work without errors!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 STEP 6: CREATE ACCOUNT & LOGIN (First Time)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to https://madeiramadeira-web.onrender.com
2. Click "Criar Conta" (Create Account)
3. Fill in:
   - Username: your-username
   - Email: your-email@example.com
   - Password: your-secure-password
4. Click "Registrar"
5. Login with your credentials
6. Navigate to:
   - Dashboard: See sales metrics and charts
   - Pedidos (Orders): View and edit orders with detail modal
   - Produtos (Products): Edit products individually or in bulk

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 FEATURES READY TO USE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Dashboard
   • Sales metrics (daily, weekly, monthly, annual)
   • Revenue charts with Recharts
   • Real-time data from MadeiraMadeira API

✅ Orders (Pedidos)
   • List all orders with pagination
   • Detail modal showing:
     - Order items with prices
     - Discount calculations (value + percentage)
     - Net value
     - MadeiraMadeira platform fee (12%)
     - Net repayment (calculated automatically)
   • Update order status (received, invoiced, delivered)

✅ Products (Produtos)
   • List all products with pagination
   • Full product edit modal:
     - Name, description, characteristics
     - EAN, brand, SKU
     - Price From / Price To
     - Stock
     - Automatic discount calculation
   • Bulk price editing
   • Real-time sync with MadeiraMadeira

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 MONITORING & LOGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Access Render Dashboard:
1. Go to https://dashboard.render.com
2. Click on "madeiramadeira-api" service
3. View real-time logs and error messages
4. Check deployment history
5. Monitor CPU and memory usage

Common Issues:
- API not starting: Check logs for DATABASE_URL error
- Frontend not loading: Check VITE_API_URL in environment variables
- Database connection failed: Verify DATABASE_URL is correct
- CORS errors: Check backend CORS configuration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 REDEPLOY AFTER CODE CHANGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Make code changes locally
2. Commit and push to GitHub:
   
   git add .
   git commit -m "your message"
   git push origin main

3. Render will automatically trigger a new deployment
4. Monitor progress in Render Dashboard
5. New version will be live when deployment completes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 OPTIMIZATION TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Free Tier Considerations:
• Database: Free tier spins down after inactivity
  - First request after idle time may take 10-30 seconds
  - Solution: Use warm-up endpoint or upgrade to paid tier

• Web Service: Auto-pauses after 15 minutes of inactivity
  - Upgrade to paid tier for always-on service

Performance:
• Add Redis caching for dashboard metrics (optional)
• Implement pagination for product/order lists
• Use CDN for frontend static assets

Scaling:
• Move to paid tier for production traffic
• Set up monitoring and alerts
• Configure auto-scaling for backend

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 SUPPORT & RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Render Documentation:
  https://render.com/docs

GitHub Repository:
  https://github.com/aRFialho/MadeiraMadeira-API

MadeiraMadeira API:
  Token: MMKTP18042018145802
  Docs: https://marketplace.madeiramadeira.com.br/docs

Database:
  URL: postgresql://madmad_user:...@dpg-d6nj2iv5r7bs73dfbh10-a.oregon-postgres.render.com/madmad

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✨ YOUR DEPLOYMENT IS READY! ✨

Follow the steps above to deploy your MadeiraMadeira Dashboard to Render.
All services (API, Frontend, Database) will be online and connected.

Good luck with your deployment! 🚀
