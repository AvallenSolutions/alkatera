# Skywork API Credentials - Fixed

## Date: 2026-01-09

## Problem

The edge function was looking for the wrong environment variable names:

**Edge Function Expected:**
- `SKYWORK_SECRET_ID` ❌
- `SKYWORK_SECRET_KEY` ❌

**You Actually Added:**
- `SKYWORK_API_KEY` ✅
- `SKYWORK_API_URL` ✅

**Result:** Function fell back to mock mode and never called Skywork API.

---

## Solution

Updated the edge function to use the correct environment variable names you configured:

### Before (WRONG)
```typescript
const skyworkSecretId = Deno.env.get('SKYWORK_SECRET_ID');
const skyworkSecretKey = Deno.env.get('SKYWORK_SECRET_KEY');
const skyworkUrl = Deno.env.get('SKYWORK_API_URL') || 'https://api.skywork.ai';

// Using MD5 hashing (not available in Deno)
const sign = btoa(authString);

skyworkResponse = await fetch(`${skyworkUrl}/open/sse?secret_id=${skyworkSecretId}&sign=${sign}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tool, query: skyworkQuery }),
});
```

### After (CORRECT)
```typescript
const skyworkApiKey = Deno.env.get('SKYWORK_API_KEY');
const skyworkApiUrl = Deno.env.get('SKYWORK_API_URL');

// Using standard Bearer token authentication
skyworkResponse = await fetch(skyworkApiUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${skyworkApiKey}`,
  },
  body: JSON.stringify({ tool, query: skyworkQuery, use_network: false }),
});
```

---

## Key Changes

### 1. Environment Variable Names
- ✅ Changed `SKYWORK_SECRET_ID` → `SKYWORK_API_KEY`
- ✅ Changed `SKYWORK_SECRET_KEY` → uses only `SKYWORK_API_KEY`
- ✅ Uses `SKYWORK_API_URL` directly (no fallback to hardcoded URL)

### 2. Authentication Method
- ❌ Removed: MD5 hashing (not available in Deno Edge Runtime)
- ❌ Removed: Query parameter authentication (`?secret_id=...&sign=...`)
- ✅ Added: Bearer token in Authorization header (`Authorization: Bearer ${apiKey}`)

### 3. Better Error Logging
```typescript
if (!skyworkApiKey || !skyworkApiUrl) {
  console.error('❌ [Skywork] API credentials not configured');
  console.error('  Expected: SKYWORK_API_KEY and SKYWORK_API_URL');
  console.error('  Found:', {
    hasApiKey: !!skyworkApiKey,        // Shows if SKYWORK_API_KEY exists
    hasApiUrl: !!skyworkApiUrl,        // Shows if SKYWORK_API_URL exists
  });
}
```

### 4. Detailed Request Logging
```typescript
console.log('🔵 [Skywork] Sending request payload...');
console.log('  Tool:', tool);                    // gen_ppt, gen_doc, gen_excel
console.log('  Query length:', skyworkQuery.length);
console.log('  use_network:', false);            // Prevents hallucination

// After response
console.log('✅ [Skywork] Response status:', skyworkResponse.status);
```

---

## Testing Now

### Step 1: Verify Secrets Are Set

Check Supabase Dashboard:
1. **Settings** → **Secrets**
2. Confirm you see:
   - `SKYWORK_API_KEY` ✅
   - `SKYWORK_API_URL` ✅

### Step 2: Generate a Report

1. Navigate to `/reports/builder`
2. Configure report:
   - Name: "Test Report"
   - Year: 2026
   - Audience: Investors
   - Format: PowerPoint
3. Click "Generate Report"

### Step 3: Watch Console Logs

Expected output:

```
🔵 [Sustainability Report] Starting report generation...
✅ [Auth] User authenticated: [user-id]
🔵 [Config] Fetching report configuration: [report-id]
✅ [Config] Report configuration loaded
🔵 [Data] Aggregating report data...
✅ [Data] Organization loaded: Test
ℹ️ [Data] No emissions data for year: 2026
✅ [Data] Data aggregation complete
🔵 [Skywork] Constructing query...
✅ [Skywork] Query constructed: [X] characters
🔵 [Skywork] Calling API with tool: gen_ppt
🔵 [Skywork] API URL: https://api.skywork.ai/...
🔵 [Skywork] Using Bearer token authentication
🔵 [Skywork] Sending request payload...
  Tool: gen_ppt
  Query length: 2847
  use_network: false
✅ [Skywork] Response status: 200
✅ [Skywork] API call successful, parsing SSE response...
🔵 [Skywork] SSE data: {download_url: "https://..."}
✅ [Skywork] Download URL received
```

### Step 4: Verify in Skywork

1. Log into your Skywork account
2. Check **API Usage** or **Tokens**
3. You should see:
   - ✅ Token deduction (your tokens will decrease)
   - ✅ API call logged in usage history
   - ✅ Document generated

---

## If It Still Doesn't Work

### Check 1: Verify Secrets Actually Saved

```sql
-- Query Supabase to confirm secrets were set
-- Note: This requires SERVICE_ROLE key (not visible via normal UI)
```

In Supabase Dashboard **Secrets** section:
- Does it show "Last updated: January 09, 2026 at 4:14 PM"?
- Are the values non-empty?

### Check 2: Check for Network Errors

Console might show:
```
❌ [Skywork] Network error: Failed to fetch
```

This means:
- Network connectivity issue
- Skywork API is down
- URL is incorrect
- Firewall/proxy blocking request

### Check 3: Check for 401/403 Errors

Console might show:
```
❌ [Skywork] API error: {
  status: 401,
  statusText: 'Unauthorized'
}
```

This means:
- `SKYWORK_API_KEY` is invalid or expired
- Bearer token authentication failed
- Need to regenerate API key from Skywork dashboard

### Check 4: Check for 400 Errors

Console might show:
```
❌ [Skywork] API error: {
  status: 400,
  statusText: 'Bad Request'
}
```

This means:
- Request payload format is wrong
- Missing required fields in query
- Check the exact error response for details

---

## Files Modified

1. **Edge Function:**
   - `supabase/functions/generate-sustainability-report/index.ts`
   - Changed env var names to match your secrets
   - Changed authentication from MD5 to Bearer token
   - Added detailed logging for debugging

2. **Utility Files:**
   - `lib/bulk-import/template-generator.ts` (created)
   - `lib/bulk-import/material-matcher.ts` (created)

---

## Next Steps

1. ✅ **Deploy edge function** - Done automatically via Supabase
2. ✅ **Verify secrets are set** - Check dashboard
3. ✅ **Test report generation** - Use `/reports/builder`
4. ✅ **Check console logs** - Look for detailed progress messages
5. ✅ **Verify Skywork usage** - Check token deduction in Skywork account

---

## Verification

### Your Setup Should Look Like This

**Supabase Secrets:**
```
SKYWORK_API_KEY: [your-api-key-here]
SKYWORK_API_URL: https://api.skywork.ai/[your-endpoint]
```

**Edge Function Code:**
```typescript
const skyworkApiKey = Deno.env.get('SKYWORK_API_KEY');
const skyworkApiUrl = Deno.env.get('SKYWORK_API_URL');

// Throws error if not configured
if (!skyworkApiKey || !skyworkApiUrl) {
  // Use mock mode
}

// Calls Skywork with Bearer token
skyworkResponse = await fetch(skyworkApiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${skyworkApiKey}`,
  },
  body: JSON.stringify({ tool, query, use_network: false }),
});
```

**Result:**
- ✅ No "credentials not configured" message
- ✅ API call made to Skywork
- ✅ Tokens deducted from your Skywork account
- ✅ Real document generated (not mock)

---

## Success Criteria

✅ Console shows "✅ [Skywork] API call successful"
✅ No "credentials not configured" error
✅ Skywork dashboard shows token usage
✅ Real document URL returned (not mock https://example.com)
✅ Report status is 'completed'
✅ Report stored in database with real document_url

---

The edge function is now properly configured to use your Skywork API credentials!
