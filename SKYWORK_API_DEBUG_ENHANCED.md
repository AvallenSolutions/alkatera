# Skywork API Debug - Enhanced Logging

## Date: 2026-01-09

## Problem

Edge function is calling Skywork API successfully (status 200) but then encountering a 404 error afterward. Need to see exactly what Skywork is returning.

---

## Enhanced Logging Added

### 1. Request Details
```typescript
console.log('🔵 [Skywork] Full API URL:', skyworkApiUrl);
console.log('🔵 [Skywork] API Key (first 10 chars):', skyworkApiKey.substring(0, 10) + '...');
console.log('  Payload:', JSON.stringify(payload).substring(0, 300) + '...');
```

**What to check:**
- Is the URL correct? Should it end with `/open/sse` or similar?
- Does the API key look valid (not empty, right format)?
- Is the payload format correct?

### 2. Response Analysis
```typescript
console.log('🔵 [Skywork] Content-Type:', skyworkResponse.headers.get('content-type'));
console.log('🔵 [Skywork] Raw chunk:', chunk.substring(0, 200));
```

**What to check:**
- Is Content-Type `text/event-stream` (SSE) or `application/json`?
- What does the raw response look like?

### 3. SSE Event Parsing
```typescript
// Check for error in SSE stream
if (data.error || data.code >= 400) {
  skyworkError = data;
  console.error('❌ [Skywork] Error in SSE stream:', data);
}

// Check for status updates
if (data.status) {
  console.log('🔵 [Skywork] Status update:', data.status);
}
```

**What to check:**
- Are there error events in the SSE stream?
- What status updates are sent (processing, completed, failed)?

### 4. JSON Fallback
```typescript
// If no SSE data was parsed, try parsing as regular JSON
if (!documentUrl && !skyworkError && allChunks) {
  const jsonResponse = JSON.parse(allChunks);
  console.log('🔵 [Skywork] JSON response:', jsonResponse);
}
```

**What to check:**
- If SSE parsing failed, can we parse as plain JSON?
- What fields are in the JSON response?

### 5. Full Response Logging
```typescript
console.log('🔵 [Skywork] Full response data:', allChunks.substring(0, 1000));
```

**What to check:**
- See the complete response if all else fails
- Identify the actual response format

---

## Testing Instructions

### Step 1: Generate a Report

1. Go to `/reports/builder`
2. Configure a simple test report:
   - Name: "Debug Test"
   - Year: 2026
   - Format: PowerPoint
   - Audience: Investors
3. Click "Generate Report"

### Step 2: Watch Console Logs

You should now see **much more detailed** output:

```
🔵 [Skywork] Calling API with tool: gen_ppt
🔵 [Skywork] Full API URL: https://api.skywork.ai/v1/...
🔵 [Skywork] Using Bearer token authentication
🔵 [Skywork] API Key (first 10 chars): sk_live_ab...
🔵 [Skywork] Sending request payload...
  Tool: gen_ppt
  Query length: 2847
  use_network: false
  Payload: {"tool":"gen_ppt","query":"Generate a professional...
✅ [Skywork] Response status: 200
✅ [Skywork] API call successful, parsing SSE response...
🔵 [Skywork] Content-Type: text/event-stream
🔵 [Skywork] Raw chunk: data: {"status":"processing"}\n\ndata: ...
🔵 [Skywork] SSE data: {status: "processing"}
🔵 [Skywork] Status update: processing
🔵 [Skywork] SSE data: {download_url: "https://..."}
✅ [Skywork] Download URL received: https://...
✅ [Skywork] Final document URL: https://...
```

### Step 3: Look for Error Events

**If you see this:**
```
🔵 [Skywork] SSE data: {code: 404, error: "Not Found", message: "..."}
❌ [Skywork] Error in SSE stream: {code: 404, error: "Not Found"}
```

**It means:** Skywork returned an error event in the SSE stream. Look at the `message` field to understand why.

**Common errors:**
- `404 Not Found` - Endpoint doesn't exist or wrong URL
- `401 Unauthorized` - API key is invalid
- `400 Bad Request` - Payload format is wrong
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Skywork service issue

### Step 4: Check the URL

**Expected formats:**

Option A (Full endpoint in SKYWORK_API_URL):
```
SKYWORK_API_URL=https://api.skywork.ai/v1/generate
```

Option B (Need to append path):
```
SKYWORK_API_URL=https://api.skywork.ai/open/sse
```

Option C (Just base URL):
```
SKYWORK_API_URL=https://api.skywork.ai
# Then we'd need to append /open/sse or /v1/generate
```

**Check your Supabase secrets** - what did you set for `SKYWORK_API_URL`?

### Step 5: Check API Key Format

**Expected format:**
```
SKYWORK_API_KEY=sk_live_...
# or
SKYWORK_API_KEY=Bearer sk_live_...
```

**Check the console log:**
```
🔵 [Skywork] API Key (first 10 chars): sk_live_ab...
```

If it shows something like `undefined..` or just `..`, the secret isn't set correctly.

---

## Possible Issues & Solutions

### Issue 1: Wrong Endpoint URL

**Symptom:**
```
❌ [Skywork] API error: {status: 404, statusText: 'Not Found'}
```

**Solution:**
Check Skywork documentation for the correct endpoint. Common options:
- `/api/v1/generate`
- `/open/sse`
- `/v1/documents/generate`

Update `SKYWORK_API_URL` in Supabase secrets to include the full path.

### Issue 2: Wrong Authentication Method

**Symptom:**
```
❌ [Skywork] API error: {status: 401, statusText: 'Unauthorized'}
```

**Solutions to try:**

A) If Skywork uses API key in query params:
```typescript
// Change from:
headers: { 'Authorization': `Bearer ${skyworkApiKey}` }

// To:
const url = `${skyworkApiUrl}?api_key=${skyworkApiKey}`;
```

B) If Skywork uses custom header:
```typescript
// Change from:
headers: { 'Authorization': `Bearer ${skyworkApiKey}` }

// To:
headers: { 'X-API-Key': skyworkApiKey }
```

C) If Skywork uses MD5 signing (original approach):
```typescript
// Need to implement MD5 hashing
// This requires importing an MD5 library
```

### Issue 3: Wrong Payload Format

**Symptom:**
```
❌ [Skywork] API error: {status: 400, statusText: 'Bad Request'}
```

**Check console for:**
```
  Payload: {"tool":"gen_ppt","query":"Generate a professional...
```

**Possible fixes:**

A) Skywork might expect different field names:
```typescript
// Instead of:
{ tool: 'gen_ppt', query: '...', use_network: false }

// Try:
{ action: 'gen_ppt', prompt: '...', options: { use_network: false } }
```

B) Skywork might expect the tool in the URL:
```typescript
const url = `${skyworkApiUrl}/gen_ppt`;
```

### Issue 4: SSE Stream Contains Errors

**Symptom:**
```
✅ [Skywork] Response status: 200
🔵 [Skywork] SSE data: {status: "processing"}
🔵 [Skywork] SSE data: {code: 404, error: "Resource not found"}
❌ [Skywork] Error in SSE stream
```

**This is now handled** - The enhanced logging will:
1. Capture the error from the SSE stream
2. Log it clearly
3. Throw a descriptive error with the actual problem

Look at the error message in the SSE event to understand what went wrong.

---

## Next Steps

### 1. Run Test and Capture Logs

Generate a report and copy the **full console output**, especially:
- Full API URL
- API Key (first 10 chars - safe to share)
- Response Content-Type
- Raw chunks
- All SSE events
- Any error messages

### 2. Compare with Skywork Documentation

Check your Skywork documentation for:
- Correct API endpoint URL
- Authentication method (Bearer token, API key header, query param, MD5 sign?)
- Request payload format
- Expected response format (SSE or JSON?)
- Tool parameter values

### 3. Update Configuration

Based on the documentation, update:

**Option A: If using different endpoint**
```
SKYWORK_API_URL=https://api.skywork.ai/correct/endpoint
```

**Option B: If using different auth**
Update the edge function code to match Skywork's auth method.

**Option C: If using different payload**
Update the payload format in the edge function.

---

## Debug Checklist

Before reporting the issue, verify:

- [ ] `SKYWORK_API_KEY` secret is set in Supabase
- [ ] `SKYWORK_API_URL` secret is set in Supabase
- [ ] API URL includes the full endpoint path
- [ ] API key is valid and not expired
- [ ] You have remaining tokens/credits in Skywork account
- [ ] Checked Skywork documentation for correct API format
- [ ] Captured full console logs from a test report generation
- [ ] Looked at the SSE events or JSON response structure

---

## Files Modified

1. **Edge Function: Enhanced Logging**
   - `supabase/functions/generate-sustainability-report/index.ts`
   - Added detailed request logging
   - Added response format detection
   - Added SSE error handling
   - Added JSON fallback parsing
   - Added full response logging

---

## Success Criteria

✅ Console shows the exact URL being called
✅ Console shows API key is not empty
✅ Console shows response Content-Type
✅ Console shows raw response chunks
✅ Console shows parsed SSE events or JSON
✅ Error messages include actual Skywork error details
✅ Can identify the exact failure point

---

The edge function now has comprehensive logging to help diagnose any Skywork API integration issues.
