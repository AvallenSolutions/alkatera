export interface ClassifyTx {
  id: string
  contactName: string | null
  description: string | null
  amount: number
}

export interface ClassifyResult {
  transactionId: string
  suggestedCategory: string | null
  confidence: number
  reasoning: string
}

interface ChunkOptions {
  organizationId: string
  transactions: ClassifyTx[]
  accessToken?: string
  chunkSize?: number
  onProgress?: (done: number, total: number) => void
}

const DEFAULT_CHUNK_SIZE = 50

export async function classifyTransactionsChunked({
  organizationId,
  transactions,
  accessToken,
  chunkSize = DEFAULT_CHUNK_SIZE,
  onProgress,
}: ChunkOptions): Promise<{ results: ClassifyResult[]; persisted: number }> {
  const chunks: ClassifyTx[][] = []
  for (let i = 0; i < transactions.length; i += chunkSize) {
    chunks.push(transactions.slice(i, i + chunkSize))
  }

  const allResults: ClassifyResult[] = []
  let totalPersisted = 0
  let done = 0

  for (const chunk of chunks) {
    const res = await fetch('/api/xero/classify-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ organizationId, transactions: chunk }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Classification failed (status ${res.status})`)
    }

    const data = (await res.json()) as { results: ClassifyResult[]; persisted?: number }
    allResults.push(...data.results)
    totalPersisted += data.persisted ?? 0
    done += chunk.length
    onProgress?.(done, transactions.length)
  }

  return { results: allResults, persisted: totalPersisted }
}
