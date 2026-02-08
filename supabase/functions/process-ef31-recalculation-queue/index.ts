import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { batch_size = 10, batch_id } = await req.json().catch(() => ({}));
    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const results: any[] = [];

    for (let i = 0; i < batch_size; i++) {
      const { data: job, error: jobError } = await supabase.rpc('get_next_recalculation_job');

      if (jobError) {
        console.error("[process-ef31-recalculation-queue] Error getting next job:", jobError);
        break;
      }

      if (!job || job.length === 0) {
        break;
      }

      const jobData = job[0];
      try {
        const calcResponse = await fetch(`${supabaseUrl}/functions/v1/calculate-product-lca-impacts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            product_carbon_footprint_id: jobData.product_carbon_footprint_id,
            calculate_ef31: true,
            force_ef31: true,
          }),
        });

        const calcResult = await calcResponse.json();

        if (calcResult.success) {
          await supabase.rpc('complete_recalculation_job', {
            p_queue_id: jobData.queue_id,
            p_success: true,
          });
          successCount++;
          results.push({
            product_carbon_footprint_id: jobData.product_carbon_footprint_id,
            status: 'success',
            ef31_single_score: calcResult.ef31_single_score,
          });
        } else {
          await supabase.rpc('complete_recalculation_job', {
            p_queue_id: jobData.queue_id,
            p_success: false,
            p_error: calcResult.error || 'Unknown calculation error',
            p_error_details: calcResult,
          });
          failureCount++;
          results.push({
            product_carbon_footprint_id: jobData.product_carbon_footprint_id,
            status: 'failed',
            error: calcResult.error,
          });
        }
      } catch (calcError: any) {
        console.error("[process-ef31-recalculation-queue] Calculation error:", calcError);
        await supabase.rpc('complete_recalculation_job', {
          p_queue_id: jobData.queue_id,
          p_success: false,
          p_error: calcError.message || 'Unexpected error during calculation',
        });
        failureCount++;
        results.push({
          product_carbon_footprint_id: jobData.product_carbon_footprint_id,
          status: 'failed',
          error: calcError.message,
        });
      }

      processedCount++;
    }

    const { data: queueStats } = await supabase
      .from('lca_recalculation_queue')
      .select('status')
      .in('status', ['pending', 'processing']);

    const remainingJobs = queueStats?.length || 0;
    return new Response(
      JSON.stringify({
        success: true,
        processed_count: processedCount,
        success_count: successCount,
        failure_count: failureCount,
        remaining_jobs: remainingJobs,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[process-ef31-recalculation-queue] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});