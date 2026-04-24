import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

// Claude-assisted requirement suggester for the Evidence Library.
//
// Sends the uploaded PDF (or image) as a document block + a compact list of
// candidate framework requirements as structured JSON, and forces a single
// tool call back with ranked matches. Sonnet 4.6 is the right balance of
// cost and schema comprehension here.

export interface RequirementCandidate {
  id: string
  framework_code: string
  requirement_code: string
  requirement_name: string
  description: string | null
}

export interface SuggestedMatch {
  requirement_id: string
  framework_code: string
  requirement_code: string
  confidence: number // 0-1
  reasoning: string
}

const SYSTEM_PROMPT = `You are a sustainability compliance specialist helping a company reuse a single evidence document across multiple reporting frameworks.

You will be given:
1. A compliance evidence document (PDF or image).
2. A list of candidate framework requirements from B Corp, VSME, ESRS, CDP, SBTi and others.

Your job: identify which of the candidate requirements the document plausibly helps evidence. Be selective. A single good match is more useful than ten weak ones. Only suggest requirements where the document clearly touches the subject of the requirement — not requirements that merely share a theme.

For each match, return:
- requirement_id: the UUID from the candidate list (exact)
- framework_code + requirement_code: echoed back for sanity
- confidence: 0.0–1.0. Use ≥0.8 only when the document directly states or proves what the requirement asks for. 0.5–0.8 when it is partial or indirect evidence. Below 0.3 should not be suggested.
- reasoning: one short sentence explaining the match, citing the document content specifically.

Cap the response at 20 matches.`

export async function suggestRequirements(opts: {
  fileBase64: string
  fileMime: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp'
  candidates: RequirementCandidate[]
  documentTitle: string
}): Promise<SuggestedMatch[]> {
  const { fileBase64, fileMime, candidates, documentTitle } = opts
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for evidence suggestions')
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const fileContent = fileMime === 'application/pdf'
    ? ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 } } as const)
    : ({ type: 'image', source: { type: 'base64', media_type: fileMime, data: fileBase64 } } as const)

  const candidateLines = candidates
    .map((c) =>
      `- [${c.id}] ${c.framework_code} ${c.requirement_code}: ${c.requirement_name}${c.description ? ' — ' + c.description.slice(0, 200) : ''}`,
    )
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        name: 'suggest_matching_requirements',
        description: 'Return the list of framework requirements the document evidences.',
        input_schema: {
          type: 'object' as const,
          properties: {
            suggestions: {
              type: 'array',
              description: 'Ranked matches, at most 20.',
              items: {
                type: 'object',
                properties: {
                  requirement_id: { type: 'string', description: 'UUID from the candidate list.' },
                  framework_code: { type: 'string' },
                  requirement_code: { type: 'string' },
                  confidence: { type: 'number', description: '0.0–1.0' },
                  reasoning: { type: 'string', description: 'One short sentence citing the doc.' },
                },
                required: ['requirement_id', 'framework_code', 'requirement_code', 'confidence', 'reasoning'],
              },
            },
          },
          required: ['suggestions'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'suggest_matching_requirements' },
    messages: [
      {
        role: 'user',
        content: [
          fileContent,
          {
            type: 'text',
            text:
              `Evidence document title: "${documentTitle}"\n\n` +
              `Candidate requirements (format: [uuid] FRAMEWORK CODE: name — description):\n` +
              candidateLines +
              `\n\nReturn ranked matches by calling the suggest_matching_requirements tool.`,
          },
        ],
      },
    ],
  })

  const toolUse = response.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return []
  }
  const input = toolUse.input as { suggestions?: SuggestedMatch[] }
  const raw = Array.isArray(input?.suggestions) ? input.suggestions : []

  // Defensive clamps: valid IDs only, confidence clamp, cap at 20.
  const candidateIds = new Set(candidates.map((c) => c.id))
  return raw
    .filter((s) => s && candidateIds.has(s.requirement_id))
    .map((s) => ({
      ...s,
      confidence: Math.max(0, Math.min(1, Number(s.confidence) || 0)),
    }))
    .filter((s) => s.confidence >= 0.3)
    .slice(0, 20)
}
