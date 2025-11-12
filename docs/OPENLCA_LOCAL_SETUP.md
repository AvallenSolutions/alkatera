# OpenLCA Local Development Setup

## Overview

This document explains how to set up and use the OpenLCA desktop application with the IPC (Inter-Process Communication) server for local development of the LCA Estimate workflow.

## Architecture

Our application uses a **self-hosted OpenLCA architecture** instead of a third-party SaaS API:

### Development Environment (Phase 1 - Current)
```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│   Next.js App   │────────▶│  Edge Function       │────────▶│  OpenLCA IPC    │
│   (Browser)     │         │  (Docker Container)  │────────▶│  Host:8080      │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
                            host.docker.internal:8080         Desktop App
```

**Note:** The Edge Function runs in a Docker container and uses `host.docker.internal:8080`
to access the OpenLCA IPC server running on your host machine.

### Production Environment (Phase 2 - Future)
```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Next.js App   │────────▶│  Edge Function   │────────▶│  OpenLCA Server │
│   (Browser)     │         │  (Supabase)      │         │  (Container)    │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                   Proxy                   Headless Server
```

## Prerequisites

### 1. Download OpenLCA Desktop Application

**Official Website:** https://www.openlca.org/download/

**Supported Platforms:**
- Windows (64-bit)
- macOS (Intel and Apple Silicon)
- Linux (64-bit)

**Recommended Version:** OpenLCA 2.0 or later

### 2. Download a Process Database

OpenLCA requires a database to search processes. Popular options:

#### Option A: ecoinvent (Recommended for Production)
- **Type:** Commercial database (subscription required)
- **Website:** https://ecoinvent.org/
- **Coverage:** Comprehensive global LCI data
- **Cost:** Paid subscription

#### Option B: ELCD (Free for Development)
- **Type:** Free European database
- **Website:** https://eplca.jrc.ec.europa.eu/ELCD3/
- **Coverage:** European LCI data
- **Cost:** Free

#### Option C: US LCI (Free for US Data)
- **Type:** Free US database
- **Website:** https://www.nrel.gov/lci/
- **Coverage:** US-focused LCI data
- **Cost:** Free

### 3. Import Database into OpenLCA

1. Launch OpenLCA desktop application
2. Create a new database:
   - Click **File → New Database**
   - Name it (e.g., "Development_DB")
   - Click **Finish**
3. Import database content:
   - Right-click on your database
   - Select **Import → File**
   - Choose your downloaded database file (.zolca format)
   - Wait for import to complete (can take 10-30 minutes)

## Starting the IPC Server

### Step-by-Step Instructions

1. **Launch OpenLCA Desktop Application**
   - Open OpenLCA from your Applications folder or Start menu

2. **Activate Your Database**
   - Right-click on your database in the Navigation panel
   - Select **Activate Database**
   - Wait for activation to complete (status bar shows active database)

3. **Open Developer Tools**
   - Click **Tools** in the menu bar
   - Select **Developer Tools**
   - A new window or panel will appear

4. **Start IPC Server**
   - In the Developer Tools window, find the **IPC Server** section
   - Click **Start IPC Server**
   - Default port is **8080** (do not change this)
   - You should see a message: "IPC Server started on port 8080"

5. **Verify Server is Running**
   - The Developer Tools window should show "Status: Running"
   - Port should display as "8080"

### Visual Confirmation

When the IPC server is running correctly, you should see:
```
┌──────────────────────────────────┐
│      Developer Tools - IPC       │
├──────────────────────────────────┤
│ Status:  ● Running               │
│ Port:    8080                    │
│ Database: Development_DB         │
│                                  │
│ [Stop Server]                    │
└──────────────────────────────────┘
```

## Testing the Connection

### Method 1: Browser Test (Direct Host Access)

Open your browser and navigate to:
```
http://localhost:8080/
```

You should see a response indicating the OpenLCA IPC server is running.

**Note:** This tests direct access from your host machine. The Edge Function uses
`host.docker.internal:8080` to access the same server from within its Docker container.

### Method 2: cURL Test (Direct Host Access)

Run this command in your terminal:
```bash
curl -X POST http://localhost:8080 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "find",
    "params": {
      "type": "Process",
      "query": "glass"
    }
  }'
```

Expected response (example):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": [
    {
      "@id": "abc-123-def-456",
      "name": "Glass bottle production",
      "categoryPath": "Materials/Packaging"
    }
  ]
}
```

**Note:** The OpenLCA IPC server uses JSON-RPC 2.0 protocol, not REST endpoints.

### Method 3: Application Test

1. Start your Next.js development server:
   ```bash
   npm run dev
   ```

2. Navigate to the LCA Workbench:
   ```
   http://localhost:3000/lca-workbench
   ```

3. Click **"Add Platform Estimate"** button

4. Type a search term (e.g., "glass")

5. After 300ms, you should see results from your local OpenLCA database

## Environment Configuration

### Local Development (.env.local)

Add this environment variable to your `.env.local` file:

```env
# OpenLCA Configuration
ENV_MODE=local
```

This tells the Edge Function to proxy requests to `http://host.docker.internal:8080`.

### Docker Networking Explanation

The Supabase Edge Functions run in Docker containers. When you run `supabase start`, the
Edge Function container needs to access the OpenLCA IPC server running on your host machine.

**Network Architecture:**
- Your browser connects to: `http://localhost:3000` (Next.js)
- Next.js calls Edge Function at: Supabase URL
- Edge Function (in Docker) connects to: `http://host.docker.internal:8080`
- `host.docker.internal` is Docker's special DNS name for the host machine
- OpenLCA IPC server listens on: `localhost:8080` (on your host)

**Why not just `localhost`?**
Inside the Docker container, `localhost` refers to the container itself, not your host
machine. Docker provides `host.docker.internal` as a reliable way to reach the host.

### Production Deployment (.env.production)

For production deployment, configure:

```env
# OpenLCA Configuration
ENV_MODE=production
PRODUCTION_OPENLCA_URL=https://openlca-server.yourdomain.com
```

The CTO will provide the production URL once the containerized server is deployed.

## Troubleshooting

### Issue: "Cannot connect to local OpenLCA server"

**Symptoms:**
- Error message in browser console
- UI shows "Cannot connect to local OpenLCA server"

**Solutions:**

1. **Verify OpenLCA is Running**
   - Check that OpenLCA desktop app is open
   - Confirm database is activated (shown in status bar)

2. **Verify IPC Server is Started**
   - Open Tools → Developer Tools
   - Check that IPC Server shows "Status: Running"
   - Port should be 8080

3. **Check Port Availability**
   ```bash
   # macOS/Linux
   lsof -i :8080

   # Windows (PowerShell)
   netstat -ano | findstr :8080
   ```
   - If another process is using port 8080, stop it or configure OpenLCA to use a different port

4. **Restart IPC Server**
   - Click **Stop Server** in Developer Tools
   - Wait 2-3 seconds
   - Click **Start Server** again

5. **Restart OpenLCA Application**
   - Quit OpenLCA completely
   - Relaunch the application
   - Activate database
   - Start IPC Server

### Issue: "No results found"

**Symptoms:**
- Search completes successfully
- Empty results list displayed

**Solutions:**

1. **Verify Database Content**
   - Open OpenLCA desktop app
   - Navigate to **Processes** folder in Navigation panel
   - Confirm processes are present in your database

2. **Try Broader Search Terms**
   - Instead of "glass bottle 750ml", try just "glass"
   - OpenLCA search is case-insensitive but specific

3. **Check Database Activation**
   - Ensure correct database is activated
   - Status bar should show: "Database: [YourDatabaseName]"

### Issue: "JSON-RPC error from OpenLCA"

**Symptoms:**
- Error message mentioning "JSON-RPC"
- Invalid method or params errors

**Solutions:**

1. **Update OpenLCA Version**
   - Ensure you're running OpenLCA 2.0 or later
   - Older versions may have different IPC implementations

2. **Verify IPC Server is JSON-RPC Compatible**
   - Test with the cURL command provided in Method 2 above
   - Response should have `jsonrpc`, `id`, and `result` fields

3. **Check Method Support**
   - The `find` method with `type: "Process"` is standard
   - If unsupported, consult OpenLCA IPC documentation

### Issue: "Search is very slow"

**Symptoms:**
- Searches take >5 seconds
- Timeout errors occur

**Solutions:**

1. **Database Size**
   - Large databases (e.g., full ecoinvent) can be slow
   - Consider using a smaller database for development

2. **Computer Resources**
   - OpenLCA is Java-based and can be memory-intensive
   - Close other applications to free up RAM
   - Check Activity Monitor/Task Manager for memory usage

3. **Index Database**
   - In OpenLCA, go to **Tools → Developer Tools**
   - Click **Rebuild Search Index**
   - Wait for indexing to complete

### Issue: Edge Function times out

**Symptoms:**
- 504 Gateway Timeout error
- Function execution exceeds time limit

**Solutions:**

1. **Check Timeout Configuration**
   - Local mode timeout: 5 seconds
   - Production mode timeout: 30 seconds
   - Adjust in Edge Function if needed

2. **Optimize Search Terms**
   - Avoid very broad searches (e.g., "material")
   - Use specific terms to reduce result set

## API Endpoints

The OpenLCA IPC server exposes several endpoints. We currently use:

### Search Endpoint

**URL:** `GET /search?q={searchTerm}`

**Query Parameters:**
- `q` (required): Search term (minimum 3 characters)

**Response Format:**
```json
[
  {
    "@id": "process-uuid",
    "name": "Process name",
    "categoryPath": "Category/Subcategory"
  }
]
```

**Example Request:**
```bash
curl "http://localhost:8080/search?q=electricity"
```

**Example Response:**
```json
[
  {
    "@id": "abc-123-def-456",
    "name": "Electricity, medium voltage, production UCTE",
    "categoryPath": "Energy/Electricity"
  },
  {
    "@id": "ghi-789-jkl-012",
    "name": "Electricity, low voltage, production UCTE",
    "categoryPath": "Energy/Electricity"
  }
]
```

### Future Endpoints (Not Yet Implemented)

- `GET /processes/{id}` - Get detailed process information
- `GET /flows` - List available flows
- `GET /impacts` - List available impact categories
- `POST /calculate` - Perform LCA calculation

## Workflow Summary

### Developer Workflow

1. **Morning Setup:**
   - Launch OpenLCA desktop app
   - Activate development database
   - Start IPC server on port 8080
   - Verify connection with browser test

2. **Development:**
   - Work on frontend/backend code
   - Test LCA Estimate workflow
   - Search returns real data from local database

3. **End of Day:**
   - Stop IPC server (optional, but recommended)
   - Close OpenLCA app (optional)

### User Workflow (Application)

1. User opens LCA Workbench
2. Clicks "Add Platform Estimate"
3. Types search term (e.g., "steel production")
4. After 300ms debounce, search is triggered
5. Edge Function proxies to `localhost:8080`
6. OpenLCA IPC server searches local database
7. Results returned and cached (24 hours)
8. User clicks a process to add it
9. Activity data point created with `source_type='platform_estimate'`

## Production Deployment Notes

### For DevOps/CTO

When deploying to production:

1. **Containerize OpenLCA:**
   - Use OpenLCA headless server mode
   - Build Docker image with database pre-loaded
   - Expose on internal network (not public internet)

2. **Configure Edge Function:**
   - Set `ENV_MODE=production` in Supabase environment
   - Set `PRODUCTION_OPENLCA_URL=https://internal-openlca-server.local`
   - Update timeout to 30 seconds for production

3. **Security Considerations:**
   - OpenLCA server should NOT be publicly accessible
   - Edge Function acts as authentication gateway
   - All requests must include valid Supabase JWT

4. **Scaling:**
   - OpenLCA server is stateful (database loaded in memory)
   - Vertical scaling recommended over horizontal
   - Consider read replicas for high traffic

5. **Monitoring:**
   - Track OpenLCA server health
   - Monitor response times
   - Alert on connection failures

## Additional Resources

### Official Documentation
- OpenLCA User Manual: https://www.openlca.org/learning/
- OpenLCA IPC Protocol: https://github.com/GreenDelta/olca-ipc.py
- OpenLCA Forum: https://ask.openlca.org/

### Video Tutorials
- Getting Started with OpenLCA: https://www.youtube.com/watch?v=xxxx
- Importing Databases: https://www.youtube.com/watch?v=yyyy

### Community Support
- OpenLCA Ask Forum: https://ask.openlca.org/
- OpenLCA GitHub: https://github.com/GreenDelta/olca-app

## Summary

**Key Points:**
- OpenLCA desktop app must be running with IPC server on port 8080
- Edge Function automatically proxies to local server in development
- Edge Function uses `host.docker.internal:8080` for Docker networking
- Production deployment will use containerized headless server
- No code changes needed when transitioning to production
- Cache reduces load on local OpenLCA instance

**Environment Variables:**
- `ENV_MODE=local` → Proxy to `host.docker.internal:8080` (from Docker container)
- `ENV_MODE=production` → Proxy to `PRODUCTION_OPENLCA_URL`

**Docker Networking:**
- `localhost:8080` - Direct access from your host machine (browser, cURL)
- `host.docker.internal:8080` - Access from Docker container (Edge Function)

**JSON-RPC Protocol:**
- OpenLCA IPC server uses JSON-RPC 2.0 (not REST)
- Method: `POST` to base URL (no path parameters)
- Request body: `{ "jsonrpc": "2.0", "id": 1, "method": "find", "params": {...} }`
- Response: `{ "jsonrpc": "2.0", "id": 1, "result": [...] }`
- Edge Function automatically handles JSON-RPC wrapping/unwrapping

**Developer Checklist:**
- [ ] OpenLCA desktop app installed
- [ ] Database imported and activated
- [ ] IPC server running on port 8080
- [ ] Connection verified with browser test
- [ ] `.env.local` configured with `ENV_MODE=local`
- [ ] Next.js dev server running
- [ ] LCA Workbench search working

---

**Last Updated:** 2025-11-12
**Maintained By:** Engineering Team
**Next Review:** After production containerization complete
