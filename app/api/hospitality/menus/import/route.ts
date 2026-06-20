/**
 * Menu import — extraction step.
 *
 * POST /api/hospitality/menus/import  (multipart/form-data, field "file")
 *   → { menu_name: string | null, items: [{ name, kind, ingredients[] }] }
 *
 * Reads a spreadsheet / PDF / photo of a menu and returns a normalised list of
 * meals and drinks for the user to review before committing. Capturing only
 * names + ingredient names; quantities are added later per dish. Runs inline:
 * a menu is a single small document, comfortably under the sync ceiling.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveUserOrganization } from '@/lib/supabase/resolve-organization'
import { extractMenu } from '@/lib/hospitality/menu-import'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_BYTES = 8 * 1024 * 1024 // 8MB
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
])

function isAcceptable(name: string, mime: string): boolean {
  if (ACCEPTED_MIME.has(mime)) return true
  return /\.(pdf|jpe?g|png|webp|xlsx|xls|csv)$/i.test(name)
}

/** Spreadsheets are parsed deterministically; only PDF/image needs the vision model. */
function needsVision(name: string, mime: string): boolean {
  const lower = name.toLowerCase()
  const isSpreadsheet =
    /\.(xlsx|xls|csv)$/i.test(lower) ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'text/csv' ||
    mime === 'application/csv'
  return !isSpreadsheet
}

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { organizationId, error: orgErr } = await resolveUserOrganization(client as any, user)
  if (orgErr || !organizationId) return NextResponse.json({ error: orgErr || 'No organisation' }, { status: 403 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload (multipart/form-data).' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: 'The file is empty.' }, { status: 400 })
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is too large. Please upload a menu under 8MB.' }, { status: 413 })
  }
  if (!isAcceptable(file.name, file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file. Upload a PDF, photo (JPEG/PNG/WebP) or spreadsheet (XLSX/CSV).' },
      { status: 415 },
    )
  }
  if (needsVision(file.name, file.type) && !process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      { error: 'Reading PDFs and photos is not configured (ANTHROPIC_API_KEY). You can still import a spreadsheet, or add items manually.' },
      { status: 503 },
    )
  }

  try {
    const fileBytes = new Uint8Array(await file.arrayBuffer())
    const result = await extractMenu({ fileBytes, fileName: file.name, fileMime: file.type })
    if (result.items.length === 0) {
      return NextResponse.json(
        { error: 'We could not find any meals or drinks in that file. Try a clearer photo or a spreadsheet with a name column.' },
        { status: 422 },
      )
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not read the menu.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
