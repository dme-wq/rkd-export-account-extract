# RKD Export Leads Gmail Account Extractor

**WebApp** for sending Gmail emails & auto-logging leads to Google Sheets.

## 🚀 Setup Guide

### Step 1: Google Cloud Console

1. Go to → [console.cloud.google.com](https://console.cloud.google.com/)
2. Create a new project → name: `RKD-Gmail-Extractor`
3. Enable these APIs:
   - **Gmail API**
   - **Google Sheets API**
4. **OAuth Consent Screen** → External → Fill app details:
   - App name: `RKD Export Leads Gmail Account Extractor`
   - Scopes: `gmail.send`, `gmail.readonly`, `spreadsheets`, `email`, `profile`
5. **Credentials** → Create OAuth 2.0 Client ID → Web Application
   - Redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://YOUR-APP.vercel.app/api/auth/callback/google`
   - Copy **Client ID** and **Client Secret**

### Step 2: Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
NEXTAUTH_SECRET=run_openssl_rand_-base64_32_to_generate
NEXTAUTH_URL=http://localhost:3000
SPREADSHEET_ID=1sfIboMW5CYT9v8EjbFNyx5gJhgRoXBABMwOMpLQX9XM
```

**Generate secret:**
```bash
openssl rand -base64 32
```

### Step 3: Run Locally

```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### Step 4: Deploy to Vercel

1. Push to GitHub
2. Import repo in [vercel.com](https://vercel.com)
3. Add Environment Variables (same as .env.local but with NEXTAUTH_URL = your Vercel URL)
4. Deploy!

### Step 5: Update OAuth Redirect URI

Add `https://YOUR-APP.vercel.app/api/auth/callback/google` in Google Cloud Console.

## 📱 Mobile PWA Install

When you open the app on Android Chrome or Safari iOS, tap **"Install App"** banner → adds to home screen!

## 📋 Google Sheets Structure

| A | B | C | D | E | F |
|---|---|---|---|---|---|
| First Name | Last Name | Email ID | CC Email ID | BCC Email ID | Signature |

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Auth:** NextAuth.js v4 (Google OAuth)
- **Email:** Gmail API via googleapis
- **Data Storage:** Google Sheets API
- **UI:** Tailwind CSS (Gmail-inspired design)
- **PWA:** Web App Manifest + Service Worker
- **Deploy:** Vercel (zero-config)
