import { goClient } from '@/lib/api/go-client'

// Helper to translate a single batch
async function translateBatch(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
  console.log(`📤 Sending batch of ${Object.keys(content).length} items to Backend...`)
  
  try {
    const response = await goClient.post<{ translations: Record<string, string> }>('/ai/translate', {
      content,
      target_language: targetLanguage
    })
    return response.translations
  } catch (error: any) {
    console.error('❌ Translation error:', error)
    throw new Error(`Failed to translate batch: ${error.message}`)
  }
}

export async function translateContent(
  content: Record<string, string>,
  targetLanguage: string
): Promise<Record<string, string>> {
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
