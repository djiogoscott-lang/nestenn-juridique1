export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterStreamChunk {
  choices: Array<{
    delta: { content?: string }
    finish_reason: string | null
  }>
}

const BASE_URL = 'https://openrouter.ai/api/v1'

export const MODELS = {
  MAIN: 'mistralai/mistral-large-2512',
  FILTER: 'mistralai/mistral-large-2512',
  FALLBACK: 'mistralai/mistral-large-2512',
} as const

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set in environment variables')
  }
  return apiKey
}

function buildHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
    'HTTP-Referer': 'https://nestenn.com',
    'X-Title': 'Nestenn Juridique',
  }
}

export async function openRouterChat(
  messages: OpenRouterMessage[],
  model: string = MODELS.FILTER,
  maxTokens: number = 4000
): Promise<string> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: false,
      // Prompt caching support for supported providers (Anthropic, DeepSeek, etc.)
      // OpenRouter automatically applies breakpoints to the last cacheable block
      cache_control: { type: 'ephemeral' }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content

  if (typeof content !== 'string') {
    throw new Error('OpenRouter API returned an unexpected response structure')
  }

  return content
}

export async function openRouterStream(
  messages: OpenRouterMessage[],
  model: string = MODELS.MAIN,
  maxTokens: number = 4000,
  temperature: number = 0.3,
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      // Prompt caching support
      cache_control: { type: 'ephemeral' }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error ${response.status}: ${errorText}`)
  }

  if (!response.body) {
    throw new Error('OpenRouter API returned an empty response body')
  }

  return response.body
}

export async function openRouterStreamWithFallback(
  messages: OpenRouterMessage[],
  maxTokens: number = 2000,
  model: string = MODELS.MAIN,
  temperature: number = 0.3,
): Promise<ReadableStream<Uint8Array>> {
  try {
    return await openRouterStream(messages, model, maxTokens, temperature)
  } catch (err) {
    console.warn('[openrouter] model down — fallback:', err)
    return await openRouterStream(messages, MODELS.FALLBACK, maxTokens, temperature)
  }
}
