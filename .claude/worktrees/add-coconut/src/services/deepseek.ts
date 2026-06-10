/**
 * DeepSeek API 服务
 * 使用 OpenAI 兼容格式，直连 DeepSeek
 */

// 开发环境走 Vite 代理，生产环境直连
const DEEPSEEK_BASE_URL = import.meta.env.DEV
  ? '/api/deepseek'
  : (import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com')
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface StreamCallbacks {
  onDelta?: (content: string) => void
  onDone?: (fullContent: string, tokensUsed: number) => void
  onError?: (error: string) => void
}

/**
 * 流式调用 DeepSeek API
 */
export async function streamChat(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: { temperature?: number; max_tokens?: number }
): Promise<void> {
  const { onDelta, onDone, onError } = callbacks
  const temperature = options?.temperature ?? 0.8
  const max_tokens = options?.max_tokens ?? 512

  if (!DEEPSEEK_API_KEY) {
    onError?.('DeepSeek API Key 未配置，请在 .env 文件中设置 VITE_DEEPSEEK_API_KEY')
    return
  }

  try {
    const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature,
        max_tokens,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      onError?.(`API 错误 (${response.status}): ${errText}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError?.('无法读取响应流')
      return
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let tokensUsed = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter((l) => l.startsWith('data: '))

      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          onDone?.(fullContent, tokensUsed)
          return
        }
        try {
          const json = JSON.parse(data)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) {
            fullContent += delta
            onDelta?.(delta)
          }
          if (json.usage?.total_tokens) {
            tokensUsed = json.usage.total_tokens
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }

    onDone?.(fullContent, tokensUsed)
  } catch (err: any) {
    onError?.(`网络错误: ${err.message}`)
  }
}

/**
 * 非流式调用（用于记忆提取等异步任务）
 */
export async function chat(
  messages: ChatMessage[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('DeepSeek API Key 未配置')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
      stream: false,
    }),
  })

  if (!response.ok) {
    throw new Error(`API 错误 (${response.status})`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}
