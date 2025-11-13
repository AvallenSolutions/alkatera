# Netlify Deployment Checklist - Authentication Fix

**Last Updated:** 2025-11-13
**Objective:** Ensure Netlify deployment has correct Supabase credentials

---

## ✅ Pre-Deployment Checklist

### 1. Environment Variables Configuration

Log in to **Netlify Dashboard** → Select your site → **Site configuration** → **Environment variables**

#### Required Variables (2 total):

| # | Variable Name | Value | Status |
|---|--------------|-------|--------|
| 1 | `NEXT_PUBLIC_SUPABASE_URL` | `https://dfcezkyaejrxmbwunhry.supabase.co` | ⬜ |
| 2 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmY2V6a3lhZWpyeG1id3VuaHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM0NTIsImV4cCI6MjA3ODE4OTQ1Mn0.zIx1i8Y-VMH9YU1nU0_yKRH2A9Qu17gZfDPb8wj4ey8` | ⬜ |

#### Verification Steps:

1. ⬜ Both variables exist in Netlify
2. ⬜ Variable names are **exactly** as shown (case-sensitive, including `NEXT_PUBLIC_` prefix)
3. ⬜ Values match **character-for-character** (no extra spaces, no missing characters)
4. ⬜ Variables are set for **all deploy contexts** (Production, Deploy Previews, Branch deploys)

---

## 🚀 Deployment Steps

### Step 1: Clear Cache and Deploy

1. Navigate to: **Deploys** tab
2. Click: **Trigger deploy** button (dropdown)
3. Select: **Clear cache and deploy site**
4. Wait for deployment to complete

⚠️ **Important:** You MUST use "Clear cache and deploy" not "Deploy site" to ensure environment variables are refreshed.

### Step 2: Monitor Build Logs

While deploying, check the build logs for:

✅ **Good signs:**
```
Building Next.js production bundle...
Generating static pages...
Build completed successfully
```

❌ **Bad signs:**
```
Missing environment variable: NEXT_PUBLIC_SUPABASE_URL
Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY
Error: Failed to create Supabase client
```

If you see any "Missing environment variable" errors, **STOP** and return to Step 1.

---

## 🧪 Post-Deployment Testing

### Test 1: Homepage Loads

1. ⬜ Open your Netlify site URL in **Incognito/Private window**
2. ⬜ Verify homepage loads without errors
3. ⬜ Open browser DevTools Console (F12)
4. ⬜ Check for JavaScript errors (should be none)

### Test 2: Login Page Loads

1. ⬜ Navigate to: `/login`
2. ⬜ Verify login form displays correctly
3. ⬜ Check browser Console for errors
4. ⬜ Check Network tab for any failed requests

### Test 3: Authentication Works

#### If you have an existing account:

1. ⬜ Enter your email and password
2. ⬜ Click "Sign In"
3. ⬜ Open Network tab and look for request to `dfcezkyaejrxmbwunhry.supabase.co`
4. ⬜ Verify request includes `apikey` header
5. ⬜ Check response:
   - ✅ 200 = Success (should redirect to dashboard)
   - ✅ 400 = Wrong email/password but **authentication system works**
   - ❌ 401 = Wrong API key (return to environment variables)
   - ❌ Failed/Cancelled = Network issue or wrong URL

#### If you don't have an account:

1. ⬜ Navigate to: `/signup`
2. ⬜ Enter: Full name, email, password
3. ⬜ Click "Sign Up"
4. ⬜ Verify account is created
5. ⬜ Verify automatic redirect to `/create-organization`

### Test 4: Organisation Creation

1. ⬜ After signup, verify redirect to `/create-organization`
2. ⬜ Enter an organisation name
3. ⬜ Click "Create Company"
4. ⬜ Verify organisation is created
5. ⬜ Verify redirect to `/dashboard`

### Test 5: Dashboard Loads with User Data

1. ⬜ Verify dashboard displays user information
2. ⬜ Verify organisation name appears in header
3. ⬜ Verify no authentication errors in console
4. ⬜ Verify user can navigate to different pages

---

## 🔍 Troubleshooting Guide

### Problem: Environment variables not found during build

**Symptoms:**
- Build logs show "Missing environment variable"
- Build fails or completes with warnings

**Solution:**
1. Return to **Site configuration** → **Environment variables**
2. Click **Add a variable** for each missing variable
3. Ensure variable names start with `NEXT_PUBLIC_`
4. **Scopes**: Select all (Production, Deploy Previews, Branch deploys)
5. Trigger **Clear cache and deploy site**

---

### Problem: Login form loads but authentication fails

**Symptoms:**
- Login form displays correctly
- Clicking "Sign In" shows error
- Network tab shows 401 Unauthorized

**Solution:**
1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Netlify
2. Compare with value in this document (character by character)
3. Update if different
4. Trigger **Clear cache and deploy site**

---

### Problem: No network requests to Supabase

**Symptoms:**
- Login button does nothing
- No requests in Network tab to `dfcezkyaejrxmbwunhry.supabase.co`
- Console shows "undefined" errors

**Solution:**
1. Environment variables not loaded into build
2. Verify variable names include `NEXT_PUBLIC_` prefix
3. Verify variables are set for **Production** scope
4. Delete and re-add both variables
5. Trigger **Clear cache and deploy site**

---

### Problem: CORS errors

**Symptoms:**
- Console shows "CORS policy" error
- Requests to Supabase are blocked

**Solution:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` is exactly:
   - `https://dfcezkyaejrxmbwunhry.supabase.co`
   - No trailing slash
   - Must be HTTPS not HTTP
2. Check Supabase dashboard for allowed origins
3. Trigger **Clear cache and deploy site**

---

## 📊 Verification Matrix

| Test | Expected Result | Pass/Fail | Notes |
|------|----------------|-----------|-------|
| Environment variables exist | Both variables present in Netlify | ⬜ | |
| Variable names correct | Exact match with this document | ⬜ | |
| Variable values correct | Character-for-character match | ⬜ | |
| Build completes | No environment variable errors | ⬜ | |
| Homepage loads | No errors in console | ⬜ | |
| Login page loads | Form displays correctly | ⬜ | |
| Supabase API reachable | Network request to supabase.co | ⬜ | |
| Authentication works | Login succeeds or fails with 400 | ⬜ | |
| Signup works | Can create new account | ⬜ | |
| Organisation creation | Can create organisation | ⬜ | |
| Dashboard loads | Shows user data | ⬜ | |

---

## 🎯 Success Criteria

Authentication is considered **WORKING** when:

✅ Users can sign up for new accounts
✅ Users can log in with email/password
✅ Login failures show appropriate error messages (wrong password, etc.)
✅ Successful login redirects to dashboard
✅ Dashboard displays user information
✅ Users can create organisations
✅ Users can log out
✅ Protected routes require authentication
✅ No Supabase-related errors in browser console

---

## 📞 Support Resources

**Supabase Project:** dfcezkyaejrxmbwunhry
**Supabase Dashboard:** https://supabase.com/dashboard/project/dfcezkyaejrxmbwunhry

**Netlify Deployment Docs:**
- Environment variables: https://docs.netlify.com/environment-variables/overview/
- Clear cache: https://docs.netlify.com/configure-builds/manage-dependencies/#cache-basics

**Next.js Environment Variables:**
- https://nextjs.org/docs/app/building-your-application/configuring/environment-variables

---

## 🔄 If All Else Fails

1. **Delete all environment variables** in Netlify
2. **Re-add both variables** from scratch (copy from this document)
3. **Delete all deploys** (Deploys → Options → Delete)
4. **Trigger new deployment** with cache clear
5. **Test in fresh Incognito window**

---

## ✅ Final Verification Command

To verify credentials work (for comparison):

**Local testing:**
```bash
# In project directory
npm run dev
# Open http://localhost:3000/login
# Try logging in
```

If authentication works locally but not in production, the issue is **definitely** with Netlify configuration.

---

**Document Version:** 1.0
**Last Verified:** 2025-11-13
**Status:** Ready for deployment ✅
