/**
 * Test script for OpenLCA integration
 * Run with: npx tsx scripts/test-openlca-integration.ts
 */

import { OpenLCAClient } from '../lib/openlca/client';

async function main() {
  const serverUrl = process.env.OPENLCA_SERVER_URL || 'http://localhost:8080';

  console.log('🔬 Testing OpenLCA Integration');
  console.log('================================');
  console.log(`Server URL: ${serverUrl}`);
  console.log('');

  const client = new OpenLCAClient(serverUrl);

  // Test 1: Health check
  console.log('1️⃣ Testing server connection...');
  try {
    const processCount = await client.getProcessCount();
    console.log(`   ✅ Connected! Found ${processCount.toLocaleString()} processes`);
  } catch (error) {
    console.log(`   ❌ Connection failed: ${error}`);
    process.exit(1);
  }

  // Test 2: Search for processes
  console.log('\n2️⃣ Searching for "wheat grain" processes...');
  try {
    const processes = await client.getAllProcesses();
    const wheatProcesses = processes.filter(p =>
      p.name?.toLowerCase().includes('wheat grain')
    );
    console.log(`   ✅ Found ${wheatProcesses.length} wheat grain processes`);

    if (wheatProcesses.length > 0) {
      console.log('   Sample processes:');
      wheatProcesses.slice(0, 3).forEach(p => {
        console.log(`   - ${p.name} (${p['@id']})`);
      });
    }
  } catch (error) {
    console.log(`   ❌ Search failed: ${error}`);
  }

  // Test 3: Get impact methods
  console.log('\n3️⃣ Getting impact methods...');
  try {
    const methods = await client.getAllImpactMethods();
    const recipeMethod = methods.find(m =>
      m.name?.toLowerCase().includes('recipe 2016') &&
      m.name?.toLowerCase().includes('midpoint (h)')
    );

    if (recipeMethod) {
      console.log(`   ✅ Found ReCiPe 2016: ${recipeMethod.name}`);
      console.log(`   ID: ${recipeMethod['@id']}`);
    } else {
      console.log(`   ⚠️ ReCiPe 2016 Midpoint (H) not found`);
      console.log(`   Available methods: ${methods.slice(0, 5).map(m => m.name).join(', ')}...`);
    }
  } catch (error) {
    console.log(`   ❌ Failed to get impact methods: ${error}`);
  }

  // Test 4: Run a calculation
  console.log('\n4️⃣ Running test calculation for wheat grain...');
  try {
    const processes = await client.getAllProcesses();
    const wheatProcess = processes.find(p =>
      p.name?.toLowerCase().includes('wheat grain production') &&
      p.name?.toLowerCase().includes('cutoff')
    ) || processes.find(p =>
      p.name?.toLowerCase().includes('wheat grain')
    );

    if (!wheatProcess) {
      console.log('   ⚠️ No wheat grain process found for calculation test');
    } else {
      console.log(`   Calculating impacts for: ${wheatProcess.name}`);

      const impacts = await client.calculateProcess(
        wheatProcess['@id']!,
        'ReCiPe 2016',
        1  // 1 kg
      );

      console.log(`   ✅ Calculation complete! Got ${impacts.length} impact categories`);

      // Find and display key impacts
      const climateImpact = impacts.find(i =>
        i.impactCategory?.name?.toLowerCase().includes('climate')
      );
      const landImpact = impacts.find(i =>
        i.impactCategory?.name?.toLowerCase().includes('land use')
      );
      const waterImpact = impacts.find(i =>
        i.impactCategory?.name?.toLowerCase().includes('water use')
      );

      console.log('\n   Key impacts (per kg):');
      if (climateImpact) {
        console.log(`   🌡️  Climate Change: ${climateImpact.amount?.toFixed(4)} ${climateImpact.impactCategory?.refUnit}`);
      }
      if (landImpact) {
        console.log(`   🌍 Land Use: ${landImpact.amount?.toFixed(4)} ${landImpact.impactCategory?.refUnit}`);
      }
      if (waterImpact) {
        console.log(`   💧 Water Use: ${waterImpact.amount?.toFixed(4)} ${waterImpact.impactCategory?.refUnit}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Calculation failed: ${error}`);
  }

  console.log('\n================================');
  console.log('✅ OpenLCA integration test complete!');
}

main().catch(console.error);
