/**
 * POST /api/boq-materials/recommend
 *
 * AI material recommendation for a BOQ line item. The client pre-filters the
 * master_materials list down to a compact candidate set and POSTs it here; this
 * route asks Claude (Sonnet) to select the required materials and returns a
 * validated, structured list. If the Anthropic API key/quota is unavailable, it
 * falls back to the same keyword scorer the client used to build candidates.
 *
 * Runs as a Node serverless function (Netlify) — the Anthropic SDK is not Edge-safe.
 */
import Anthropic from '@anthropic-ai/sdk'
import {
  heuristicRecommend,
  type MasterMaterialLite,
  type Recommendation,
} from '@/lib/boq-item-workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RecommendRequest {
  description: string
  unit: string
  quantity: number
  candidates: MasterMaterialLite[]
}

const TOOL_NAME = 'submit_recommendations'

const RECOMMENDATION_TOOL: Anthropic.Tool = {
  name: TOOL_NAME,
  description:
    'Return the list of materials required to execute the BOQ line item, matched to candidate master materials where possible.',
  input_schema: {
    type: 'object',
    properties: {
      recommendations: {
        type: 'array',
        description: 'The materials required for this BOQ line item.',
        items: {
          type: 'object',
          properties: {
            material_id: {
              type: ['string', 'null'],
              description:
                'The id of a candidate master material when one clearly corresponds, otherwise null for a free-text suggestion.',
            },
            material_name: { type: 'string', description: 'Material name.' },
            unit: { type: ['string', 'null'], description: 'Unit of measure if known, else null.' },
            estimated_quantity: {
              type: ['number', 'null'],
              description:
                'Estimated quantity only when confidently derivable from the BOQ quantity, otherwise null.',
            },
            confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
            rationale: { type: 'string', description: 'Short reason this material is required.' },
          },
          required: ['material_id', 'material_name', 'unit', 'estimated_quantity', 'confidence', 'rationale'],
          additionalProperties: false,
        },
      },
    },
    required: ['recommendations'],
    additionalProperties: false,
  },
}

const SYSTEM_PROMPT =
  'You are a construction QA/QS assistant. Given a BOQ (Bill of Quantities) line item and a candidate list of master materials, ' +
  'select the materials required to execute that line item. Match a material to a candidate `id` when it clearly corresponds; ' +
  'otherwise propose it as free-text with material_id=null. Only estimate a per-material quantity when it is confidently ' +
  'derivable from the BOQ quantity, otherwise use null. Prefer fewer, well-justified materials over a long speculative list. ' +
  'Always respond by calling the submit_recommendations tool.'

export async function POST(req: Request): Promise<Response> {
  let body: RecommendRequest
  try {
    body = (await req.json()) as RecommendRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { description, unit, quantity, candidates } = body || ({} as RecommendRequest)
  if (!description || !Array.isArray(candidates)) {
    return Response.json({ error: 'description and candidates are required' }, { status: 400 })
  }

  // No key configured → heuristic fallback (graceful, never 500 for an AI outage).
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ source: 'heuristic', recommendations: heuristicRecommend(description, candidates) })
  }

  const candidateById = new Map(candidates.map((c) => [c.id, c]))

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const userText =
      `BOQ line item description:\n${description}\n\n` +
      `Unit: ${unit || 'n/a'}\nBOQ quantity: ${quantity ?? 'n/a'}\n\n` +
      `Candidate master materials (JSON):\n${JSON.stringify(candidates)}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [RECOMMENDATION_TOOL],
      tool_choice: { type: 'tool', name: TOOL_NAME },
      messages: [{ role: 'user', content: userText }],
    })

    const toolBlock = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === TOOL_NAME
    )
    const raw = (toolBlock?.input as { recommendations?: unknown })?.recommendations
    if (!Array.isArray(raw)) {
      return Response.json({ source: 'heuristic', recommendations: heuristicRecommend(description, candidates) })
    }

    // Validate & normalize: reject hallucinated ids (downgrade to free-text);
    // when matched, use the canonical candidate name/unit.
    const recommendations: Recommendation[] = raw.map((r: Record<string, unknown>) => {
      const id = typeof r.material_id === 'string' ? r.material_id : null
      const match = id ? candidateById.get(id) : undefined
      const confidence =
        r.confidence === 'high' || r.confidence === 'medium' || r.confidence === 'low'
          ? (r.confidence as Recommendation['confidence'])
          : 'medium'
      return {
        material_id: match ? match.id : null,
        material_name: match ? match.name : String(r.material_name ?? '').trim() || 'Unnamed material',
        unit: match ? match.unit : typeof r.unit === 'string' ? r.unit : null,
        estimated_quantity:
          typeof r.estimated_quantity === 'number' && isFinite(r.estimated_quantity)
            ? r.estimated_quantity
            : null,
        confidence,
        rationale: typeof r.rationale === 'string' ? r.rationale : '',
      }
    })

    return Response.json({ source: 'ai', recommendations })
  } catch (err) {
    // Missing/invalid key, quota, network, or any model error → heuristic fallback.
    console.error('AI recommend failed, falling back to heuristic:', err)
    return Response.json({ source: 'heuristic', recommendations: heuristicRecommend(description, candidates) })
  }
}
