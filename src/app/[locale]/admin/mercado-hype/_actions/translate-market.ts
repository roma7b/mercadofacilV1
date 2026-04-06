'use server'

/**
 * Tradução de nomes de mercados e outcomes usando IA (Placeholder).
 */
export async function translateMarketAI(title: string, description: string, outcomes: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const translateText = (text: string) => {
      return text
        .replace(/\bWill\b/gi, 'Será que')
        .replace(/\bwin\b/gi, 'vencerá')
        .replace(/\bPresidential Election\b/gi, 'Eleição Presidencial')
        .replace(/\belection\b/gi, 'eleição')
        .replace(/\bby\b/gi, 'até')
        .replace(/\bwin\b/gi, 'ganha')
    }

    const translatedOutcomes = outcomes.map(oc => {
      if (oc.toLowerCase() === 'yes') return 'SIM'
      if (oc.toLowerCase() === 'no') return 'NÃO'
      return oc
    })

    return {
      success: true,
      data: {
        question: translateText(title),
        description: translateText(description || ''),
        outcomes: translatedOutcomes
      }
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

