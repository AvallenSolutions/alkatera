#!/bin/bash
# Setup Skywork secrets for Supabase Edge Functions

echo "Setting up Skywork API secrets for Supabase Edge Functions..."
echo ""
echo "Run these commands in your terminal:"
echo ""
echo "npx supabase login"
echo ""
echo "npx supabase secrets set SKYWORK_SECRET_ID=2164df284e890217e194ef234f13ba1c --project-ref dfcezkyaejrxmbwunhry"
echo ""
echo "npx supabase secrets set SKYWORK_SECRET_KEY=b2fc6435b13e91ad9e2e10a174a2ea72583ffbf57dcc3f6ebc9623c50fc0da47 --project-ref dfcezkyaejrxmbwunhry"
echo ""
echo "After setting secrets, restart the edge function:"
echo "npx supabase functions deploy generate-sustainability-report --project-ref dfcezkyaejrxmbwunhry"
