const SENDER_API_BASE = 'https://api.sender.net/v2'

export interface SyncSubscriberInput {
  email: string
  firstname?: string
  lastname?: string
  company?: string
  groupIds?: string[]
}

export interface SyncSubscriberResult {
  ok: boolean
  status?: number
  alreadyExisted?: boolean
  error?: string
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function attachToGroup(token: string, groupId: string, email: string): Promise<void> {
  const res = await fetch(`${SENDER_API_BASE}/subscribers/groups/${groupId}`, {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify({ subscribers: [email] }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(
      `[sender] attach-to-group failed (group=${groupId}, email=${email}): status=${res.status} body=${body}`
    )
  }
}

export async function syncSubscriber(input: SyncSubscriberInput): Promise<SyncSubscriberResult> {
  const token = process.env.SENDER_API_TOKEN
  if (!token) {
    console.warn('[sender] SENDER_API_TOKEN not configured — skipping sync')
    return { ok: false, error: 'SENDER_API_TOKEN not configured' }
  }

  const payload: Record<string, unknown> = { email: input.email }
  if (input.firstname) payload.firstname = input.firstname
  if (input.lastname) payload.lastname = input.lastname
  if (input.company) payload.company = input.company
  if (input.groupIds && input.groupIds.length > 0) payload.groups = input.groupIds

  let res: Response
  try {
    res = await fetch(`${SENDER_API_BASE}/subscribers`, {
      method: 'POST',
      headers: buildHeaders(token),
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[sender] network error during subscriber sync:', err)
    return { ok: false, error: err instanceof Error ? err.message : 'network error' }
  }

  if (res.ok) {
    return { ok: true, status: res.status }
  }

  const body = await res.text().catch(() => '')

  if (res.status === 422 && input.groupIds && input.groupIds.length > 0) {
    for (const groupId of input.groupIds) {
      await attachToGroup(token, groupId, input.email)
    }
    return { ok: true, status: res.status, alreadyExisted: true }
  }

  console.error(`[sender] subscriber sync failed (email=${input.email}): status=${res.status} body=${body}`)
  return { ok: false, status: res.status, error: body || `HTTP ${res.status}` }
}

function splitFullName(fullName?: string | null): { firstname?: string; lastname?: string } {
  if (!fullName) return {}
  const trimmed = fullName.trim()
  if (!trimmed) return {}
  const parts = trimmed.split(/\s+/)
  const firstname = parts[0]
  const lastname = parts.length > 1 ? parts.slice(1).join(' ') : undefined
  return { firstname, lastname }
}

export interface AlkateraCustomerInput {
  email: string
  fullName?: string | null
  company?: string | null
}

export async function syncAlkateraCustomer(input: AlkateraCustomerInput): Promise<SyncSubscriberResult> {
  const groupId = process.env.SENDER_ALKATERA_CUSTOMERS_GROUP_ID
  if (!groupId) {
    console.warn('[sender] SENDER_ALKATERA_CUSTOMERS_GROUP_ID not configured — skipping sync')
    return { ok: false, error: 'SENDER_ALKATERA_CUSTOMERS_GROUP_ID not configured' }
  }

  const { firstname, lastname } = splitFullName(input.fullName)

  return syncSubscriber({
    email: input.email,
    firstname,
    lastname,
    company: input.company || undefined,
    groupIds: [groupId],
  })
}
