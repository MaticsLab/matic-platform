
const API_KEY = 'AIzaSyDF5pYStCPVI8UWCKtaOx2Ueu-LF_CUBe4'; // User provided key

export async function translateContent(
  content: Record<string, string>, 
  targetLanguage: string
): Promise<Record<string, string>> {
  const prompt = `
    Translate the following JSON object values into ${targetLanguage}. 
    Keep the keys exactly the same. 
    Return ONLY the JSON object.
    
    ${JSON.stringify(content, null, 2)}
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Gemini API error:', data);
      throw new Error('Failed to translate');
    }

    const text = data.candidates[0].content.parts[0].text;
    // Clean up markdown code blocks if present
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}
