import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // DEBUGGING TRACE: Log incoming request payload
    const payload = await req.json();
    console.log('Incoming request payload:', JSON.stringify(payload, null, 2));

    const {
      facility_id,
      emission_source_id,
      quantity,
      unit,
      reporting_period_start,
      reporting_period_end,
    } = payload;

    // Validate required fields
    if (!facility_id || !emission_source_id || !quantity || !unit || !reporting_period_start || !reporting_period_end) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Supabase client with user's JWT
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Authenticated user:', user.id);

    // Security validation: Check if user has access to this facility
    const { data: facilityCheck, error: facilityError } = await supabase
      .from('facilities')
      .select('id, organization_id')
      .eq('id', facility_id)
      .single();

    if (facilityError || !facilityCheck) {
      console.error('Facility check error:', facilityError);
      return new Response(
        JSON.stringify({ error: 'Facility not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is a member of the facility's organization
    const { data: memberCheck, error: memberError } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', facilityCheck.organization_id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberCheck) {
      console.error('Organization membership check error:', memberError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not have access to this facility' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Authorization check passed for facility:', facility_id);

    // Insert the activity data
    const { data: activityData, error: insertError } = await supabase
      .from('facility_activity_data')
      .insert({
        facility_id,
        emission_source_id,
        quantity,
        unit,
        reporting_period_start,
        reporting_period_end,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to insert activity data', details: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Activity data inserted successfully:', activityData.id);

    return new Response(
      JSON.stringify({ success: true, data: activityData }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});