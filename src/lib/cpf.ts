export function normalizeCpf(value: string | null | undefined) {
  return String(value || '').replace(/\D/g, '')
}

export function formatCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) {
    return cpf
  }

  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function isValidCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value)

  if (cpf.length !== 11) {
    return false
  }

  if (/^(\d)\1{10}$/.test(cpf)) {
    return false
  }

  const digits = cpf.split('').map(Number)

  const calculateDigit = (sliceLength: number) => {
    let sum = 0
    for (let i = 0; i < sliceLength; i++) {
      sum += digits[i] * ((sliceLength + 1) - i)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  const firstDigit = calculateDigit(9)
  const secondDigit = calculateDigit(10)

  return firstDigit === digits[9] && secondDigit === digits[10]
}

export function maskCpf(value: string | null | undefined) {
  const cpf = normalizeCpf(value)
  if (cpf.length !== 11) {
    return cpf
  }

  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`
}
