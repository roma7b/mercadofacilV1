import { useExtracted } from 'next-intl'

type OutcomeLabel = string | null | undefined

export function useOutcomeLabel() {
  const t = useExtracted()

  return function normalizeOutcomeLabel(label: OutcomeLabel) {
    if (label === 'Yes') {
      return t('Sim')
    }
    if (label === 'No') {
      return t('Não')
    }
    if (label === 'Up') {
      return t('Up')
    }
    if (label === 'Down') {
      return t('Down')
    }
    return label ?? ''
  }
}
