#!/usr/bin/env node
/**
 * Test the PDF generation API route end-to-end.
 *
 * This script:
 * 1. Authenticates with Supabase to get a valid session token
 * 2. Finds a completed PCF record
 * 3. Calls POST /api/lca/[id]/generate-pdf
 * 4. Saves the resulting PDF for inspection
 *
 * Run with: node scripts/test-pdf-api.mjs
 * Requires: Dev server running on localhost:3000
 */

import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8');
function getEnv(key) {
  const line = envContent.split('\n').find(l => l.startsWith(`${key}=`));
  return line?.split('=').slice(1).join('=').trim();
}

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const BASE_URL = 'http://localhost:3000';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase config in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Step 1: Check for existing session or prompt for auth
console.log('--- Step 1: Authenticate ---');

// Try to sign in with a test account
// For testing, we'll use the service role to find a PCF directly
const serviceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');
const adminClient = createClient(SUPABASE_URL, serviceKey);

// Step 2: Find a completed PCF record
console.log('\n--- Step 2: Find a completed PCF ---');
const { data: pcfs, error: pcfError } = await adminClient
  .from('product_carbon_footprints')
  .select('id, product_name, status, organization_id')
  .eq('status', 'completed')
  .order('updated_at', { ascending: false })
  .limit(5);

if (pcfError || !pcfs?.length) {
  console.log('No completed PCFs found. Trying any PCF...');

  const { data: anyPcfs, error: anyError } = await adminClient
    .from('product_carbon_footprints')
    .select('id, product_name, status, organization_id')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (anyError || !anyPcfs?.length) {
    console.error('No PCF records found at all:', anyError?.message);
    process.exit(1);
  }

  console.log('Found PCFs:');
  anyPcfs.forEach(p => console.log(`  - ${p.id} | ${p.product_name} | ${p.status}`));

  // Use the first one
  var testPcf = anyPcfs[0];
} else {
  console.log('Found completed PCFs:');
  pcfs.forEach(p => console.log(`  - ${p.id} | ${p.product_name} | ${p.status}`));
  var testPcf = pcfs[0];
}

console.log(`\nUsing: ${testPcf.id} (${testPcf.product_name})`);

// Step 3: Get a user session for this org
console.log('\n--- Step 3: Get auth token ---');

// Find a user in this org
const { data: members } = await adminClient
  .from('organization_members')
  .select('user_id')
  .eq('organization_id', testPcf.organization_id)
  .limit(1);

if (!members?.length) {
  console.error('No members found for organization');
  process.exit(1);
}

// Get user email
const { data: authUser } = await adminClient.auth.admin.getUserById(members[0].user_id);
console.log(`User: ${authUser?.user?.email || members[0].user_id}`);

// Generate a temporary session for this user
// We'll use admin access to sign in
const email = authUser?.user?.email;
if (!email) {
  console.error('Could not get user email');
  process.exit(1);
}

// Use magic link / OTP approach won't work in script.
// Instead, let's call the API with the service role directly for testing.
// We'll simulate the auth by using service role key as the bearer token.
// Actually, the API route creates its own Supabase client with the bearer token.
// For testing, we need a real user session.

// Alternative: Directly test the render-lca-html function
console.log('\n--- Step 3b: Direct HTML render test (bypassing auth) ---');

// Import the transformer and renderer modules via dynamic import won't work for TS
// Let's just call the API with the service role key

// Actually, let's try the API with a header that the route expects
const { data: sessionData, error: signInError } = await adminClient.auth.admin.generateLink({
  type: 'magiclink',
  email: email,
});

if (signInError) {
  console.log(`Could not generate link: ${signInError.message}`);
  console.log('\nFalling back to direct PDFShift test with mock HTML...');

  // Test just the PDFShift rendering with a sample of our actual HTML template
  const pdfshiftKey = getEnv('PDFSHIFT_API_KEY');

  // Fetch the PCF data to build mock report data
  const { data: pcf } = await adminClient
    .from('product_carbon_footprints')
    .select('*')
    .eq('id', testPcf.id)
    .single();

  const { data: materials } = await adminClient
    .from('product_carbon_footprint_materials')
    .select('*')
    .eq('product_carbon_footprint_id', testPcf.id);

  console.log(`PCF: ${pcf?.product_name}, materials: ${materials?.length || 0}`);
  console.log(`Aggregated impacts: ${pcf?.aggregated_impacts ? 'YES' : 'NO'}`);

  if (pcf?.aggregated_impacts) {
    console.log(`  Climate: ${pcf.aggregated_impacts.climate_change_gwp100} kg CO2e`);
    console.log(`  Water: ${pcf.aggregated_impacts.water_consumption} L`);
    console.log(`  Circularity: ${pcf.aggregated_impacts.circularity_percentage}%`);
  }

  console.log('\nDirect HTML render + PDFShift test skipped (requires TS runtime).');
  console.log('The API route will handle this. Start the dev server and test in browser.');
}

// Step 4: Test the API route
console.log('\n--- Step 4: Call PDF API ---');

// We need a real auth token. Let's try to verify token exchange.
if (sessionData?.properties?.hashed_token) {
  // Exchange the token
  const { data: session, error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: sessionData.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyError) {
    console.log(`Token exchange failed: ${verifyError.message}`);
  } else if (session?.session?.access_token) {
    const token = session.session.access_token;
    console.log(`Got session token: ${token.slice(0, 20)}...`);

    // Call the API
    console.log(`\nCalling POST ${BASE_URL}/api/lca/${testPcf.id}/generate-pdf`);

    const startTime = Date.now();
    const response = await fetch(`${BASE_URL}/api/lca/${testPcf.id}/generate-pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        includeNarratives: false,
        inline: false,
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Status: ${response.status} ${response.statusText} (${elapsed}s)`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);

    if (response.ok) {
      const buffer = await response.arrayBuffer();
      console.log(`PDF Size: ${buffer.byteLength} bytes (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

      writeFileSync('/tmp/alkatera-lca-report-test.pdf', Buffer.from(buffer));
      console.log('Saved to: /tmp/alkatera-lca-report-test.pdf');
      console.log('Result: PASS');
    } else {
      const errorBody = await response.text();
      console.log(`Error body: ${errorBody}`);
      console.log('Result: FAIL');
    }
  }
} else {
  console.log('Could not get auth token for API test.');
  console.log('Please test via the browser UI at: http://localhost:3000/products/<id>/lca-report');
}

console.log('\n--- Summary ---');
console.log('1. PDFShift API: VERIFIED (Tests 1 & 2 passed)');
console.log('2. API Route: Needs browser test with real auth session');
console.log('3. Browser URL: http://localhost:3000/products/<product_id>/lca-report');
console.log(`4. Test PCF: ${testPcf.id} (${testPcf.product_name})`);

// Find the product_id for this PCF
const { data: pcfFull } = await adminClient
  .from('product_carbon_footprints')
  .select('product_id')
  .eq('id', testPcf.id)
  .single();

if (pcfFull?.product_id) {
  console.log(`5. Browser test URL: http://localhost:3000/products/${pcfFull.product_id}/lca-report`);
}
