// Test script to check what the API sees
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing supplier products query...\n');
console.log('Supabase URL:', supabaseUrl);
console.log('Organization ID: 2d86de84-e24e-458b-84b9-fd4057998bda\n');

async function testQuery() {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // This simulates what the API route does
  const { data, error } = await supabase
    .from('supplier_products')
    .select(`
      id,
      name,
      category,
      unit,
      suppliers!inner(
        name
      )
    `)
    .eq('organization_id', '2d86de84-e24e-458b-84b9-fd4057998bda')
    .eq('is_active', true)
    .limit(5);
  
  console.log('Query result:');
  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

testQuery();
