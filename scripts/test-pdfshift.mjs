#!/usr/bin/env node
/**
 * Quick test script for PDFShift API connectivity.
 * Run with: node scripts/test-pdfshift.mjs
 */

import { readFileSync } from 'fs';

// Load .env.local
const envContent = readFileSync('.env.local', 'utf8');
const apiKey = envContent
  .split('\n')
  .find(line => line.startsWith('PDFSHIFT_API_KEY='))
  ?.split('=')[1]
  ?.trim();

if (!apiKey) {
  console.error('PDFSHIFT_API_KEY not found in .env.local');
  process.exit(1);
}

console.log(`API Key: ${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`);

// Test 1: Simple HTML to PDF
console.log('\n--- Test 1: Simple HTML conversion ---');
try {
  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      source: `<html><body><h1 style="color: #ccff00; background: #1c1917; padding: 40px; font-family: sans-serif;">AlkaTera LCA Report Test</h1><p style="padding: 20px;">If you can read this, PDFShift is working correctly.</p></body></html>`,
      format: 'A4',
      sandbox: true, // Use sandbox mode (free, watermarked)
    }),
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Content-Type: ${response.headers.get('content-type')}`);
  console.log(`Pages: ${response.headers.get('x-pdfshift-pages') || 'N/A'}`);

  if (response.ok) {
    const buffer = await response.arrayBuffer();
    console.log(`PDF Size: ${buffer.byteLength} bytes (${(buffer.byteLength / 1024).toFixed(1)} KB)`);
    console.log('Result: PASS');
  } else {
    const errorText = await response.text();
    console.log(`Error: ${errorText}`);
    console.log('Result: FAIL');
  }
} catch (error) {
  console.error('Network error:', error.message);
  console.log('Result: FAIL');
}

// Test 2: Test with Google Fonts (like our actual report)
console.log('\n--- Test 2: HTML with Google Fonts + CSS ---');
try {
  const html = `<!DOCTYPE html>
<html><head>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;700&family=Inter:wght@400;600&family=Fira+Code:wght@500;700&display=swap" rel="stylesheet" />
  <style>
    body { margin: 0; font-family: 'Inter', sans-serif; }
    .page { width: 794px; height: 1123px; background: #1c1917; color: white; padding: 48px; display: flex; flex-direction: column; justify-content: center; }
    h1 { font-family: 'Playfair Display', serif; font-size: 72px; font-weight: 300; }
    .badge { background: #ccff00; color: black; padding: 16px 24px; border-radius: 8px; display: inline-block; font-family: 'Fira Code', monospace; font-weight: 700; }
    .donut { width: 150px; height: 150px; border-radius: 50%; background: conic-gradient(#22c55e 0deg 216deg, #eab308 216deg 288deg, #ef4444 288deg 360deg); position: relative; }
    .donut-inner { position: absolute; inset: 30px; background: #1c1917; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="page">
    <div class="badge">LIFE CYCLE ASSESSMENT</div>
    <h1 style="margin-top: 32px;">Test Product</h1>
    <p style="color: #a8a29e; font-size: 18px; margin-top: 16px;">AlkaTera Platform</p>
    <div style="display: flex; gap: 24px; margin-top: 48px; align-items: center;">
      <div class="donut"><div class="donut-inner"><span style="font-family: 'Playfair Display', serif; font-size: 32px; font-weight: 700; color: #ccff00;">85%</span></div></div>
      <div>
        <div style="font-family: 'Fira Code', monospace; color: #ccff00; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Data Quality</div>
        <div style="font-size: 14px; color: #a8a29e; margin-top: 8px;">Fonts, gradients, and layouts rendering correctly</div>
      </div>
    </div>
  </div>
</body></html>`;

  const response = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify({
      source: html,
      format: 'A4',
      sandbox: true,
      delay: 2000, // Wait for Google Fonts to load
    }),
  });

  console.log(`Status: ${response.status} ${response.statusText}`);

  if (response.ok) {
    const buffer = await response.arrayBuffer();
    console.log(`PDF Size: ${buffer.byteLength} bytes (${(buffer.byteLength / 1024).toFixed(1)} KB)`);

    // Save to temp file for visual inspection
    const { writeFileSync } = await import('fs');
    writeFileSync('/tmp/alkatera-pdfshift-test.pdf', Buffer.from(buffer));
    console.log('Saved to: /tmp/alkatera-pdfshift-test.pdf');
    console.log('Result: PASS');
  } else {
    const errorText = await response.text();
    console.log(`Error: ${errorText}`);
    console.log('Result: FAIL');
  }
} catch (error) {
  console.error('Network error:', error.message);
  console.log('Result: FAIL');
}

console.log('\n--- Done ---');
