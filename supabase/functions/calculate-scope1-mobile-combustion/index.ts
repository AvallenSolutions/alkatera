// supabase/functions/calculate-scope1-mobile-combustion/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Initialize Supabase client using the caller's authorization
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Extract and validate payload
    const { distance, fuel_type } = await req.json()
    if (!distance || !fuel_type) {
      return new Response(JSON.stringify({ error: 'Missing required parameters: "distance" and "fuel_type"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // Sanitize input to prevent whitespace issues
    const trimmedFuelType = fuel_type.trim();

    // 3. Fetch the relevant emissions factor with a hardened query
    const { data: factor, error: factorError } = await supabase
      .from('emissions_factors')
      .select('value, unit') // Also select unit for better logging
      .ilike('name', trimmedFuelType) // Use case-insensitive matching
      .order('year', { ascending: false }) // Best practice: always use the most recent factor
      .limit(1) // Ensure we only get one result
      .maybeSingle() // Returns null instead of throwing an error if zero rows are found

    if (factorError) {
      console.error('Database error fetching emissions factor:', factorError)
      return new Response(JSON.stringify({ error: 'Database error', details: factorError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!factor) {
      console.error('Emissions factor not found for:', trimmedFuelType)
      return new Response(JSON.stringify({ error: `Emissions factor not found for: ${trimmedFuelType}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }
    // 4. Perform the calculation
    const total_emissions = distance * factor.value

    // 5. Log the calculation for auditability (The "Glass Box" Principle)
    const logEntry = {
      calculation_type: 'scope1_mobile_combustion',
      input_data: { distance, fuel_type: trimmedFuelType },
      output_data: { total_emissions },
      emissions_factor_id: null, // Note: To get this, we'd need to select 'id' from the factor table
      executed_at: new Date().toISOString(),
      status: 'success',
    }

    const { error: logError } = await supabase.from('calculation_logs').insert(logEntry)

    if (logError) {
      // Non-blocking error: Log the failure but still return the result to the user
      console.error('Error logging calculation:', logError)
    }

    // 6. Return the final result
    return new Response(JSON.stringify({ total_emissions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    // Catch any other unexpected errors
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})