# Authentication Diagnostic Report
**Generated:** 2025-11-13
**Objective:** Diagnose and resolve authentication failures in production deployment

---

## Phase 1: Backend Configuration Verification ✅

### 1.1 Supabase Credentials (Source of Truth)

The following credentials are confirmed as **VALID** and **ACTIVE**:

```
NEXT_PUBLIC_SUPABASE_URL=https://dfcezkyaejrxmbwunhry.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmY2V6a3lhZWpyeG1id3VuaHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM0NTIsImV4cCI6MjA3ODE4OTQ1Mn0.zIx1i8Y-VMH9YU1nU0_yKRH2A9Qu17gZfDPb8wj4ey8
```

### 1.2 API Connection Test Results

✅ **Supabase REST API**: Responding correctly
✅ **Authentication**: JWT token is valid
✅ **Database Schema**: All tables accessible (profiles, organizations, organization_members, etc.)

**Test Command:**
```bash
curl -s "https://dfcezkyaejrxmbwunhry.supabase.co/rest/v1/" \
  -H "apikey: [ANON_KEY]"
```

**Response:** HTTP 200 OK with OpenAPI schema (verified)

---

## Phase 2: Frontend Configuration Requirements

### 2.1 Required Environment Variables for Netlify

Your Netlify deployment **MUST** have these exact environment variables configured:

| Variable Name | Value |
|--------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dfcezkyaejrxmbwunhry.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmY2V6a3lhZWpyeG1id3VuaHJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MTM0NTIsImV4cCI6MjA3ODE4OTQ1Mn0.zIx1i8Y-VMH9YU1nU0_yKRH2A9Qu17gZfDPb8wj4ey8` |

### 2.2 Verification Steps for Netlify

**Step 1: Access Environment Variables**
1. Log in to Netlify
2. Navigate to: **Site configuration** > **Environment variables**
3. Locate both variables listed above

**Step 2: Verify Values**
- Compare the Netlify values **character-by-character** with the values above
- Common issues:
  - Extra spaces at the beginning or end
  - Missing characters due to copy/paste errors
  - Wrong variable names (e.g., missing `NEXT_PUBLIC_` prefix)
  - Old/outdated credentials from a previous Supabase project

**Step 3: Update if Necessary**
- If values don't match exactly, click **Edit** on each variable
- Paste the correct value from this document
- Click **Save**

---

## Phase 3: Deployment & Testing Instructions

### 3.1 Force Clean Rebuild

After updating environment variables in Netlify:

1. Navigate to: **Deploys** section
2. Click: **Trigger deploy** dropdown
3. Select: **Clear cache and deploy site**
4. Wait for deployment to complete (typically 2-5 minutes)

⚠️ **Critical:** A standard redeploy is **NOT** sufficient. You must clear the cache to ensure environment variables are refreshed.

### 3.2 Verification Testing

Once deployment completes:

1. **Open Incognito/Private Browser Window**
   - This ensures no cached authentication tokens interfere

2. **Navigate to Login Page**
   - URL: `https://your-site.netlify.app/login`

3. **Test Authentication**
   - Try logging in with an existing account
   - Check browser console (F12) for any error messages

4. **Expected Behaviour:**
   - ✅ Login form loads without errors
   - ✅ Clicking "Sign in" attempts authentication
   - ✅ Successful login redirects to `/dashboard`
   - ✅ User can see their organisation name in the header

---

## Phase 4: Troubleshooting Common Issues

### Issue 1: "Invalid API key" or "401 Unauthorized"

**Cause:** Environment variables are missing or incorrect

**Solution:**
1. Verify variables exist in Netlify (Phase 2.2)
2. Check for typos in variable names or values
3. Ensure both variables have the `NEXT_PUBLIC_` prefix
4. Force clean rebuild (Phase 3.1)

### Issue 2: "Failed to fetch" or CORS errors

**Cause:** Supabase URL is incorrect or unreachable

**Solution:**
1. Verify URL is exactly: `https://dfcezkyaejrxmbwunhry.supabase.co`
2. No trailing slash
3. Must start with `https://` not `http://`
4. Force clean rebuild (Phase 3.1)

### Issue 3: Login form works but authentication fails silently

**Cause:** JWT token expiry or malformed token

**Solution:**
1. Clear browser cookies and local storage
2. Open Network tab in DevTools
3. Check the response from Supabase auth endpoints
4. If JWT is expired, copy fresh token from this document
5. Update in Netlify and force clean rebuild

### Issue 4: "Missing Supabase environment variables"

**Cause:** Variables not injected into build process

**Solution:**
1. Verify variable names include `NEXT_PUBLIC_` prefix
2. Check variables are set in **Site settings**, not just **Build settings**
3. Force clean rebuild (Phase 3.1)
4. If issue persists, delete variables and re-add them

---

## Phase 5: Advanced Debugging

### 5.1 Browser Console Checks

After attempting login, check browser console for:

```javascript
// Expected: Should NOT see these errors
❌ "Failed to load Supabase client"
❌ "NEXT_PUBLIC_SUPABASE_URL is undefined"
❌ "Invalid API key"
❌ "Network request failed"

// Expected: Should see these messages
✅ Network requests to "https://dfcezkyaejrxmbwunhry.supabase.co/auth/v1/..."
✅ Response status: 200 or 400 (400 with error message is OK, means credentials work)
```

### 5.2 Network Tab Analysis

1. Open DevTools > Network tab
2. Filter by: `Fetch/XHR`
3. Attempt login
4. Look for requests to `dfcezkyaejrxmbwunhry.supabase.co`

**Healthy request should show:**
- Request URL: `https://dfcezkyaejrxmbwunhry.supabase.co/auth/v1/token?grant_type=password`
- Request Headers include: `apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Response: Either 200 (success) or 400 with error message (credentials work, wrong email/password)

**Unhealthy request shows:**
- 401 Unauthorized → Wrong API key
- Failed/Cancelled → Wrong URL or network issue
- No request at all → Environment variables not loaded

---

## Phase 6: Database & RLS Configuration

### 6.1 Database Status

✅ **Tables Created:** All core tables exist
- profiles
- organizations
- organization_members
- roles
- permissions
- role_permissions

✅ **Row Level Security (RLS):** Enabled on all tables

✅ **Helper Functions:** Available
- `user_has_permission()`
- `get_user_role()`
- `handle_new_user()` trigger

### 6.2 Authentication Flow

The application uses Supabase Auth with the following configuration:

```typescript
// lib/supabaseClient.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Maintains login across page refreshes
    autoRefreshToken: true,     // Automatically renews expired tokens
    detectSessionInUrl: true,   // Handles email confirmation links
  },
})
```

---

## Summary & Next Steps

### Current Status
✅ Backend credentials are valid and working
✅ Supabase API is accessible
✅ Database schema is complete
✅ Local `.env` file has correct values

### Action Required
1. **Verify Netlify environment variables** (Phase 2.2)
2. **Update if necessary** with exact values from this document
3. **Force clean rebuild** on Netlify (Phase 3.1)
4. **Test in Incognito window** (Phase 3.2)

### Expected Outcome
After completing these steps, authentication should work correctly. Users will be able to:
- Sign up for new accounts
- Log in with email/password
- Create organisations
- Invite team members
- Access protected routes

---

## Support Information

**Supabase Project Reference:** `dfcezkyaejrxmbwunhry`
**Supabase Region:** Unknown (check Supabase dashboard)
**Application:** AlkaTera - Carbon Management Platform
**Framework:** Next.js 13.5.1 (App Router)
**Authentication Method:** Email/Password (Supabase Auth)

---

## Appendix: Testing Credentials Work Locally

To verify these credentials work (for comparison with production):

1. Ensure `.env` file contains the credentials from Phase 1.1
2. Run: `npm run dev`
3. Open: `http://localhost:3000/login`
4. Attempt login

If this works locally but fails in production, the issue is **definitely** with Netlify environment variables or build cache.
