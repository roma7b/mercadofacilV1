import OpenAI from 'openai'

// Initialize the OpenAI client.
// It will pick up the OPENAI_API_KEY from the environment variables.
const openai = new OpenAI()

export async function translateTexts(texts: string[], targetLang: string = 'Portuguese'): Promise<string[]> {
  if (!texts || texts.length === 0) return []
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Translate the following JSON array of strings to ${targetLang}. Preserve the array structure, string formatting, and do NOT add any markdown formatting or extra text outside the valid JSON array.`
        },
        {
          role: 'user',
          content: JSON.stringify(texts)
        }
      ],
      temperature: 0.3,
    })

    const rawContent = response.choices[0]?.message?.content || '[]'
    
    // Clean up possible markdown code blocks around the JSON
    const cleanContent = rawContent.replace(/```json\n?|\n?```/g, '').trim()
    
    const translated = JSON.parse(cleanContent)
    
    if (Array.isArray(translated) && translated.length === texts.length) {
      return translated
    } else {
      console.error('Translation array length mismatch', { original: texts, translated })
      return texts
    }
  } catch (error) {
    console.error('Failed to translate texts:', error)
    return texts // fallback to original texts
  }
}
