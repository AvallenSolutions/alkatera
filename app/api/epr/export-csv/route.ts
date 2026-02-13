import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { generateRPDCSV, calculateCSVChecksum } from '@/lib/epr/csv-generator'
import type { EPRSubmissionLine } from '@/lib/epr/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticateAndAuthorize(organizationId: string) {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) { return cookieStore.get(name)?.value },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return { user: null, authorized: false }

  const serviceClient = getServiceClient()
  const { data: membership } = await serviceClient
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) {
    const { data: advisorAccess } = await serviceClient
      .from('advisor_organization_access')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('advisor_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!advisorAccess) return { user, authorized: false }
  }

  return { user, authorized: true }
}

/**
 * POST /api/epr/export-csv
 *
 * Generate RPD-format CSV from an existing submission and store in Supabase Storage.
 *
 * Input: { organizationId, submissionId }
 * Returns: { download_url, checksum, filename }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { organizationId, submissionId } = body

    if (!organizationId || !submissionId) {
      return NextResponse.json(
        { error: 'organizationId and submissionId are required' },
        { status: 400 }
      )
    }

    const { user, authorized } = await authenticateAndAuthorize(organizationId)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const supabase = getServiceClient()

    // Fetch submission
    const { data: submission, error: subError } = await supabase
      .from('epr_submissions')
      .select('*')
      .eq('id', submissionId)
      .eq('organization_id', organizationId)
      .single()

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Fetch submission lines
    const { data: lines, error: linesError } = await supabase
      .from('epr_submission_lines')
      .select('*')
      .eq('submission_id', submissionId)
      .order('rpd_packaging_material', { ascending: true })

    if (linesError || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: 'No submission lines found. Please generate the submission first.' },
        { status: 400 }
      )
    }

    // Generate CSV
    const csv = generateRPDCSV(lines as EPRSubmissionLine[])
    const checksum = await calculateCSVChecksum(csv)

    // Store in Supabase Storage
    const filename = `rpd_${submission.submission_period}_${new Date().toISOString().split('T')[0]}.csv`
    const storagePath = `${organizationId}/${submissionId}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('epr-exports')
      .upload(storagePath, csv, {
        contentType: 'text/csv',
        upsert: true,
      })

    if (uploadError) {
      console.error('Error uploading CSV to storage:', uploadError)
      // Return the CSV directly if storage fails
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-CSV-Checksum': checksum,
        },
      })
    }

    // Get signed download URL (valid for 1 hour)
    const { data: signedUrl } = await supabase.storage
      .from('epr-exports')
      .createSignedUrl(storagePath, 3600)

    // Update submission record with CSV info
    await supabase
      .from('epr_submissions')
      .update({
        csv_generated_at: new Date().toISOString(),
        csv_storage_path: storagePath,
        csv_checksum: checksum,
        status: submission.status === 'draft' ? 'ready' : submission.status,
      })
      .eq('id', submissionId)

    // Write audit log
    await supabase.from('epr_audit_log').insert({
      organization_id: organizationId,
      entity_type: 'submission',
      entity_id: submissionId,
      action: 'generate_csv',
      snapshot: {
        filename,
        storage_path: storagePath,
        checksum,
        line_count: lines.length,
        submission_period: submission.submission_period,
        fee_year: submission.fee_year,
      },
      performed_by: user.id,
    })

    return NextResponse.json({
      download_url: signedUrl?.signedUrl || null,
      checksum,
      filename,
      storage_path: storagePath,
      line_count: lines.length,
    })
  } catch (err) {
    console.error('EPR export-csv POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
