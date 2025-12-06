const COHERE_API_KEY = process.env.NEXT_PUBLIC_COHERE_API_KEY || ''

export async function translateContent(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  if (!COHERE_API_KEY) {
    throw new Error('Missing NEXT_PUBLIC_COHERE_API_KEY')
  }

  const prompt = `You are a precise translator. Translate ONLY the JSON values into ${targetLanguage}. Keep keys identical. Return valid JSON with the same keys.`

  const body = {
    model: 'command-r-plus-08-2024',
    messages: [
      {
        role: 'system',
        content: prompt
      },
      {
        role: 'user',
        content: JSON.stringify(content, null, 2)
      }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  }

  const response = await fetch('https://api.cohere.ai/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${COHERE_API_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('Cohere translate error', errText)
    throw new Error('Failed to translate')
  }

  const data = await response.json()
  const text = data?.text || data?.message?.content || data?.generations?.[0]?.text
  if (!text) {
    console.error('Cohere translate malformed response', data)
    throw new Error('Translation response missing text')
  }

  const jsonStr = text.replace(/```json\n?|```/g, '').trim()
  return JSON.parse(jsonStr)
}
