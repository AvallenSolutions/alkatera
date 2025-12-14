// Test script to check if staging_emission_factors RLS is working
// Run this in browser console on the authenticated app

const testStagingRLS = async () => {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  console.log('Testing staging_emission_factors RLS...');

  // Test 1: Can we read global factors?
  const { data, error } = await supabase
    .from('staging_emission_factors')
    .select('*')
    .ilike('name', 'Ethanol from molasses')
    .limit(1)
    .maybeSingle();

  console.log('Query result:', { data, error });

  if (error) {
    console.error('❌ RLS BLOCKING READ:', error.message);
  } else if (data) {
    console.log('✅ RLS WORKING - Found factor:', data.name, 'CO2:', data.co2_factor);
  } else {
    console.log('⚠️  No data returned (but no error)');
  }
};

testStagingRLS();
