const COHERE_API_KEY = process.env.NEXT_PUBLIC_COHERE_API_KEY || ''

// Helper to translate a single batch
async function translateBatch(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  const prompt = `You are a precise translator. Translate ONLY the JSON values into ${targetLanguage}. Keep keys identical. Return valid JSON with the same keys.`

  const body = {
    model: 'command-r-plus-08-2024',
    message: JSON.stringify(content, null, 2),
    preamble: prompt,
    temperature: 0.2,
    max_tokens: 4000, // Limit is 4096
  }

  console.log(`📤 Sending batch of ${Object.keys(content).length} items to Cohere...`)
  
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
    console.error('❌ Cohere translate error:', errText)
    throw new Error(`Failed to translate batch: ${errText}`)
  }

  const data = await response.json()

  const messageContent = data?.message?.content
  const messageTextArray = Array.isArray(messageContent)
    ? messageContent.map((part: any) => part?.text || '').filter(Boolean)
    : []

  const text = data?.text
    || (messageTextArray.length > 0 ? messageTextArray.join('\n') : undefined)
    || (typeof messageContent === 'string' ? messageContent : undefined)
    || data?.generations?.[0]?.text

  if (!text) {
    console.error('Cohere translate malformed response', data)
    throw new Error('Translation response missing text')
  }

  let jsonStr = text.replace(/```json\n?|```/g, '').trim()
  
  // Attempt to find the JSON object if there's extra text
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1)
  }

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('❌ Failed to parse translation JSON:', e)
    console.log('Raw text:', text)
    throw new Error('Invalid JSON response from translation service')
  }
}

export async function translateContent(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  console.log('🔑 Cohere API Key present:', !!COHERE_API_KEY)
  if (!COHERE_API_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_COHERE_API_KEY')
    throw new Error('Missing NEXT_PUBLIC_COHERE_API_KEY')
  }

  const entries = Object.entries(content)
  if (entries.length === 0) {
    return {}
  }

  // Chunk size to stay safely within token limits
  // 40 items * ~50 tokens/item = ~2000 tokens, well within 4000 limit
  const CHUNK_SIZE = 40
  const chunks = []
  
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const chunkEntries = entries.slice(i, i + CHUNK_SIZE)
    chunks.push(Object.fromEntries(chunkEntries))
  }

  console.log(`📦 Split content into ${chunks.length} chunks for translation`)

  const results = await Promise.all(
    chunks.map((chunk, index) => 
      translateBatch(chunk, targetLanguage)
        .then(res => {
          console.log(`✅ Chunk ${index + 1}/${chunks.length} completed`)
          return res
        })
        .catch(err => {
          console.error(`❌ Chunk ${index + 1}/${chunks.length} failed:`, err)
          throw err
        })
    )
  )

  // Merge all results
  return results.reduce((acc, curr) => ({ ...acc, ...curr }), {})
}
