import type { SourceChunk, JuriCase } from '@/lib/system-prompt'
import type { TaggedCase, TaggedArticle } from '@/lib/post-treatment'
import { buildClaudeSystemPrompt } from '@/lib/prompts/claude-system-prompt'
import { buildMistralLargeSystemPrompt, buildMistralSmallSystemPrompt } from '@/lib/prompts/mistral-system-prompt'

/**
 * Contexte de contrôle des citations passé aux builders de prompt.
 * Distingue ce que le LLM peut citer de ce qu'il utilise pour raisonner.
 */
export interface PromptContext {
  /** Arrêts live autorisés à citer — le LLM doit utiliser uniquement leurs tags [J1]… */
  taggedLiveCases: TaggedCase[]
  /** Articles citables — le LLM doit utiliser uniquement leurs tags [A1]… */
  taggedArticles: TaggedArticle[]
  /**
   * Activer quand les sources jurisprudentielles sont faibles (≤1 live, 0 pgvector).
   * Force une réponse courte, sans spéculation, centrée sur la règle certaine.
   */
  strictConcise: boolean
}

type SystemPromptBuilder = (
  chunks: SourceChunk[],
  pgJuri: JuriCase[],
  liveJuri: JuriCase[],
  context?: PromptContext,
) => string

export interface ModelConfig {
  id: string
  name: string
  provider: string
  description: string
  badge?: string
  color: string
  maxTokens: number
  temperature: number
  buildSystemPrompt: SystemPromptBuilder
}

export const DEFAULT_MODEL_ID = 'mistralai/mistral-large-2512'

export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'mistralai/mistral-large-2512',
    name: 'Mistral Large 3',
    provider: 'Mistral AI',
    description: 'Flagship français, RGPD natif, 256K context',
    badge: 'Référence',
    color: '#FA520F',
    maxTokens: 8192,
    temperature: 0.1,
    buildSystemPrompt: buildMistralLargeSystemPrompt,  // tier='large'
  },
  {
    id: 'mistralai/mistral-small-2603',
    name: 'Mistral Small 4',
    provider: 'Mistral AI',
    description: 'Ultra économique, raisonnement Magistral intégré',
    badge: 'Économique',
    color: '#FA520F',
    maxTokens: 8192,
    temperature: 0.1,
    buildSystemPrompt: buildMistralSmallSystemPrompt,  // tier='small'
  },
]

export function getModelById(id?: string | null): ModelConfig {
  if (!id) return AVAILABLE_MODELS[0]
  return AVAILABLE_MODELS.find(m => m.id === id) ?? AVAILABLE_MODELS[0]
}

export function isAllowedModel(id: string): boolean {
  return AVAILABLE_MODELS.some(m => m.id === id)
}
