# Cloudinary Setup for Vercel Deployment

## Why Cloudinary?

Vercel serverless functions have a **read-only file system**, which means you cannot store uploaded files locally. Cloudinary provides free cloud storage for images and files, perfect for your HRMS file uploads.

## Setup Steps

### 1. Create a Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up for a **FREE account** (includes 25GB storage & 25GB bandwidth/month)
3. Verify your email

### 2. Get Your Cloudinary Credentials

1. Log in to your Cloudinary dashboard
2. You'll see your **Cloud Name**, **API Key**, and **API Secret** on the dashboard
3. Copy these values

### 3. Add Environment Variables Locally

Add these to your `backend/.env` file:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name_here
CLOUDINARY_API_KEY=your_api_key_here
CLOUDINARY_API_SECRET=your_api_secret_here
```

### 4. Add Environment Variables to Vercel

**Important:** You must add these to Vercel for production to work!

#### Option A: Using Vercel Dashboard (Recommended)
1. Go to your project on [vercel.com](https://vercel.com)
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:
   - `CLOUDINARY_CLOUD_NAME` = your cloud name
   - `CLOUDINARY_API_KEY` = your API key
   - `CLOUDINARY_API_SECRET` = your API secret
4. Make sure to select **Production**, **Preview**, and **Development**
5. Click **Save**

#### Option B: Using Vercel CLI
```bash
cd backend
vercel env add CLOUDINARY_CLOUD_NAME
# Enter your cloud name when prompted

vercel env add CLOUDINARY_API_KEY
# Enter your API key when prompted

vercel env add CLOUDINARY_API_SECRET
# Enter your API secret when prompted
```

### 5. Redeploy Your Application

After adding the environment variables:

```bash
# If you have changes to push
git add .
git commit -m "Add Cloudinary integration"
git push

# Or trigger a redeploy in Vercel dashboard
```

## What Changed?

### Backend Changes:
- ✅ Installed `cloudinary` and `multer-storage-cloudinary`
- ✅ Created `backend/src/config/cloudinary.ts` for configuration
- ✅ Updated `backend/src/routes/employeeRoutes.ts` to use Cloudinary storage
- ✅ Updated `backend/src/controller/employeeController.ts` to handle Cloudinary URLs
- ✅ Updated environment configuration in `backend/src/config/env.ts`

### Frontend Changes:
- ✅ Updated `frontend/src/views/hrms/EmployeeDetail.vue` to handle both Cloudinary URLs and local files
- ✅ Images will now load from Cloudinary or local storage automatically

## How It Works

1. When a file is uploaded, multer sends it directly to Cloudinary
2. Cloudinary stores the file and returns a full URL (e.g., `https://res.cloudinary.com/...`)
3. This URL is saved in the database instead of a local path
4. The frontend displays images using these URLs directly

## File Organization

Files are stored in Cloudinary with this structure:
```
hrms/
  └── employees/
      ├── cnicFrontFile-1234567890-123456789.jpg
      ├── cnicBackFile-1234567890-987654321.jpg
      ├── documentFile-1234567890-456789123.pdf
      └── insuranceCardFile-1234567890-789123456.jpg
```

## Troubleshooting

### Error: "CLOUDINARY_CLOUD_NAME is required"
- Make sure you've added all three Cloudinary environment variables
- Check that they're spelled correctly (exact match)
- Restart your development server after adding .env variables

### Images still not loading on Vercel
1. Check Vercel logs for errors: `vercel logs`
2. Verify environment variables are set in Vercel dashboard
3. Make sure you redeployed after adding environment variables

### Want to check if it's working?
Upload a test employee with an image and check the console logs. You should see:
```
🖼️ Using external URL: https://res.cloudinary.com/...
```

## Cost

Cloudinary Free Tier includes:
- ✅ 25GB storage
- ✅ 25GB bandwidth per month
- ✅ 25,000 transformations per month
- ✅ More than enough for most HRMS systems!

## Support

If you need help:
1. Check [Cloudinary Documentation](https://cloudinary.com/documentation)
2. Verify your environment variables are correct
3. Check Vercel deployment logs

