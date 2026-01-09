# Skywork API Setup Guide

## Overview
This project uses Skywork AI's MCP (Model Context Protocol) Server to generate professional sustainability reports in PowerPoint, Word, and Excel formats.

## Local Development Setup

The Skywork API key is already configured in `.env.local`:
```bash
SKYWORK_API_KEY=b2fc6435b13e91ad9e2e10a174a2ea72583ffbf57dcc3f6ebc9623c50fc0da47
SKYWORK_API_URL=https://api.skywork.ai
```

**Note:** `.env.local` is gitignored and should never be committed to version control.

## Production Deployment Setup

For Supabase Edge Functions to access the Skywork API in production, you need to set secrets:

### Step 1: Set Supabase Secrets

```bash
# Navigate to project root
cd /home/user/alkatera

# Set Skywork API key
supabase secrets set SKYWORK_API_KEY=b2fc6435b13e91ad9e2e10a174a2ea72583ffbf57dcc3f6ebc9623c50fc0da47

# Set Skywork API URL
supabase secrets set SKYWORK_API_URL=https://api.skywork.ai
```

### Step 2: Verify Secrets

```bash
supabase secrets list
```

You should see:
- `SKYWORK_API_KEY` (value hidden)
- `SKYWORK_API_URL`

## How It Works

### 1. Document Generation Capabilities

Skywork can generate three document types:
- **PowerPoint (PPT/PPTX)** - For presentations and executive summaries
- **Word (DOCX)** - For detailed sustainability reports
- **Excel (XLSX)** - For data-heavy reports with tables and charts

### 2. API Integration

The Skywork API uses Server-Sent Events (SSE) for real-time document generation:

```typescript
// Example API call structure
POST https://api.skywork.ai/open/sse
Headers:
  Content-Type: application/json

Body:
{
  "tool": "gen_ppt",  // or "gen_doc", "gen_excel"
  "query": "Detailed instructions with embedded data...",
  "use_network": false  // CRITICAL: Prevents hallucination
}

Response:
SSE stream with progress updates and final download URL
```

### 3. Zero-Hallucination Strategy

To ensure 100% data accuracy:
1. We fetch ALL data from the database
2. Embed exact figures in the query text
3. Set `use_network: false` to prevent external data fetching
4. Instruct Skywork to use ONLY provided data

### 4. Authentication

The Skywork API uses a simple API key authentication:
- API key is included in request headers or URL parameters
- No complex OAuth or signature generation required
- Key should be rotated periodically for security

## Edge Functions Using Skywork

### aggregate-report-data
**Purpose:** Fetches and aggregates all sustainability data from the database
**Uses Skywork:** No (preparation only)

### generate-sustainability-report
**Purpose:** Sends aggregated data to Skywork and receives generated document
**Uses Skywork:** Yes
**Access Pattern:**
```typescript
const skyworkApiKey = Deno.env.get('SKYWORK_API_KEY');
const skyworkUrl = Deno.env.get('SKYWORK_API_URL');
```

## Testing

### Test API Access

Create a test edge function:

```bash
# Test Skywork connection
curl -X POST https://api.skywork.ai/open/sse \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer b2fc6435b13e91ad9e2e10a174a2ea72583ffbf57dcc3f6ebc9623c50fc0da47" \
  -d '{
    "tool": "gen_ppt",
    "query": "Create a simple test presentation with title 'Test Report' and one slide saying 'This is a test'",
    "use_network": false
  }'
```

Expected response:
```
data: {"status": "generating"}
data: {"status": "processing"}
data: {"download_url": "https://skywork.ai/files/xxx.pptx", "status": "completed"}
```

## Security Considerations

### API Key Protection
- ✅ Never commit API keys to version control
- ✅ Use environment variables for all environments
- ✅ Rotate keys if compromised
- ✅ Limit API key permissions to document generation only

### Data Privacy
- ✅ Set `use_network: false` to prevent data leakage
- ✅ Embed all sensitive data directly in queries
- ✅ Use HTTPS for all API calls
- ✅ Download URLs expire after 24 hours (Skywork standard)

### Rate Limiting
- Implement per-organization limits (e.g., 10 reports/hour)
- Monitor API usage to detect abuse
- Set up alerts for unusual activity

## Troubleshooting

### Error: "Invalid API Key"
**Solution:** Verify the API key is correctly set in environment variables

### Error: "Document generation failed"
**Solution:** Check the `skywork_query` field in `generated_reports` table for malformed queries

### Error: "Timeout"
**Solution:** Complex reports may take 2-3 minutes. Implement proper timeout handling (5 minutes)

### Error: "Download URL not found"
**Solution:** Parse SSE response stream correctly. URL is in the final `data:` message

## Cost Monitoring

Each document generation has an associated cost:
- Track usage via `generated_reports` table
- Monitor `status = 'completed'` count
- Set up billing alerts in Skywork dashboard

Estimated costs:
- PowerPoint: ~$0.50 per report
- Word: ~$0.30 per report
- Excel: ~$0.40 per report

## Support

- **Skywork Documentation:** https://skywork.ai/docs
- **API Status:** https://status.skywork.ai
- **Support:** support@skywork.ai

## Migration Notes

If switching from Skywork to another provider:
1. All report generation logic is isolated in `generate-sustainability-report` edge function
2. Update environment variables
3. Adapt API call structure
4. Test with sample reports
5. Update this documentation
