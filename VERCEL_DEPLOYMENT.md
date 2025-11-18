# Vercel Deployment Guide for HRMS Backend

## Prerequisites
- A Vercel account (https://vercel.com)
- Your database hosted and accessible (e.g., Railway, Supabase, PlanetScale, or any PostgreSQL provider)
- Vercel CLI installed (optional): `npm i -g vercel`

## Deployment Steps

### 1. Prepare Your Repository
Your backend is now configured for Vercel deployment with:
- ✅ `vercel.json` configured
- ✅ Build scripts added to `package.json`
- ✅ TypeScript compilation setup
- ✅ Express app exported for serverless

### 2. Push to Git
Make sure your code is pushed to GitHub, GitLab, or Bitbucket:
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

### 3. Import Project to Vercel

#### Option A: Via Vercel Dashboard (Recommended)
1. Go to https://vercel.com/new
2. Import your Git repository
3. Set the **Root Directory** to: `backend`
4. Framework Preset: `Other`
5. Build Command: `npm run vercel-build`
6. Output Directory: `dist`
7. Install Command: `npm install`

#### Option B: Via Vercel CLI
```bash
cd backend
vercel
```

### 4. Configure Environment Variables

In your Vercel project dashboard, go to **Settings** → **Environment Variables** and add the following:

#### Required Variables:
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Your PostgreSQL connection string | `postgresql://user:password@host:5432/dbname` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-min-32-chars` |
| `COOKIE_SECRET` | Secret key for cookie signing | `your-super-secret-cookie-key` |

#### Optional Variables (with defaults):
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Set to `production` for Vercel |
| `API_PREFIX` | `/api/v1` | API route prefix |
| `PORT` | `3000` | Not used in Vercel (auto-assigned) |
| `JWT_EXPIRES_IN` | `7d` | JWT token expiration |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | Refresh token expiration |
| `BCRYPT_ROUNDS` | `12` | Password hashing rounds |
| `COOKIE_DOMAIN` | `localhost` | Your domain (e.g., `yourdomain.com`) |
| `COOKIE_SECURE` | `false` | Set to `true` for HTTPS |
| `COOKIE_SAME_SITE` | `strict` | Cookie SameSite policy |
| `COMPANY_NAME` | `Iris Communications` | Your company name |
| `COMPANY_DOMAIN` | `iriscommunications.com` | Your company domain |

#### SMTP Configuration (Optional):
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`

### 5. Deploy
Click **Deploy** in Vercel dashboard or run:
```bash
vercel --prod
```

### 6. Update CORS Origins
After deployment, update the CORS configuration in `src/index.ts` to include your Vercel URL:

```typescript
cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://your-frontend-app.vercel.app",  // Add your frontend URL
    "https://your-api.vercel.app",           // Add your API URL
    "https://iriscommunications.com",
    "https://www.iriscommunications.com",
  ],
  credentials: true,
  // ...
})
```

## Important Notes

### Database Connection
- Ensure your database allows connections from Vercel's IP ranges
- For development databases, enable external connections
- Consider using connection pooling (e.g., Prisma Accelerate, PgBouncer)

### File Uploads
- The `/uploads` directory won't persist on Vercel (serverless is stateless)
- Consider using cloud storage:
  - AWS S3
  - Cloudinary
  - Vercel Blob Storage
  - Uploadcare

### Socket.IO Limitation
⚠️ **Important**: Vercel serverless functions don't support persistent WebSocket connections. The Socket.IO functionality in your app won't work on Vercel.

**Solutions:**
1. Deploy Socket.IO separately (e.g., on Railway, Heroku, or a VPS)
2. Use Vercel Edge Functions (experimental WebSocket support)
3. Use a managed service like Pusher or Ably for real-time features

### ZKTeco Device Communication
The ZKTeco iClock HTTP server won't work on Vercel serverless. You need to:
1. Deploy this part on a traditional server (VPS, Railway, etc.)
2. Or use a separate microservice for device communication

## Troubleshooting

### 404 Errors
- ✅ Check that `dist/index.js` exists after build
- ✅ Verify `vercel.json` routes are correct
- ✅ Check build logs in Vercel dashboard

### Build Failures
- ✅ Ensure all environment variables are set
- ✅ Check that `DATABASE_URL` is accessible from Vercel
- ✅ Review build logs for TypeScript errors

### Database Connection Errors
- ✅ Verify `DATABASE_URL` is correct
- ✅ Check database firewall settings
- ✅ Ensure database accepts external connections
- ✅ Consider using connection pooling

### Prisma Issues
- ✅ Prisma generates during `vercel-build`
- ✅ Ensure `@prisma/client` version matches `prisma` version
- ✅ Check that schema.prisma is in the prisma directory

## Testing Your Deployment

After deployment, test your API:

```bash
# Health check
curl https://your-api.vercel.app/health

# Root endpoint
curl https://your-api.vercel.app/

# API endpoint
curl https://your-api.vercel.app/api/v1/auth/health
```

## Local Development vs. Vercel

The code now handles both environments:
- **Local**: Runs Express server with Socket.IO on specified PORT
- **Vercel**: Exports Express app, skips server creation (Vercel handles it)

The `VERCEL` environment variable (automatically set by Vercel) determines the behavior.

## Recommended Database Providers for Vercel

1. **Supabase** (PostgreSQL) - Free tier, great for development
2. **Railway** - PostgreSQL, MySQL, MongoDB
3. **PlanetScale** - MySQL with built-in branching
4. **Neon** - Serverless PostgreSQL
5. **AWS RDS** - Production-grade, requires configuration

## Next Steps

1. ✅ Deploy your backend to Vercel
2. ✅ Test all API endpoints
3. ✅ Update frontend to use new API URL
4. ✅ Set up proper monitoring (Vercel Analytics, Sentry)
5. ✅ Configure custom domain (optional)
6. ✅ Set up CI/CD (automatic deployments on push)

---

**Need Help?**
- Vercel Documentation: https://vercel.com/docs
- Prisma with Vercel: https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel
- Contact: support@vercel.com


