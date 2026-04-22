/**
 * HorsePay Service Integration
 * Handles authentication, order creation and status checking
 */

const BASE_URL = 'https://api.horsepay.io'

export interface HorsePayToken {
  access_token: string
  token_type: string
  expires_in: number
}

export interface HorsePayOrderResponse {
  payment: string // Base64 QR Code
  copy_past: string // PIX Copy and Paste
  external_id: string
  status: number // 0 for success
  message?: string
}

function collectStatusCandidates(payload: any) {
  return [
    payload?.status,
    payload?.order_status,
    payload?.payment_status,
    payload?.transaction_status,
    payload?.withdraw_status,
    payload?.withdrawal_status,
    payload?.data?.status,
    payload?.data?.order_status,
    payload?.data?.payment_status,
    payload?.data?.transaction_status,
    payload?.data?.withdraw_status,
    payload?.data?.withdrawal_status,
  ]
}

function normalizeHorsePayStatusValue(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return normalized || null
}

export class HorsePayService {
  private static async getToken(): Promise<string> {
    const clientKey = process.env.HORSE_PAY_CLIENT_KEY
    const clientSecret = process.env.HORSE_PAY_CLIENT_SECRET

    if (!clientKey || !clientSecret) {
      throw new Error('HORSE_PAY_CLIENT_KEY or HORSE_PAY_CLIENT_SECRET not configured')
    }

    const res = await fetch(`${BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_key: clientKey,
        client_secret: clientSecret,
      }),
    })

    const data = await res.json() as HorsePayToken
    if (!res.ok || !data.access_token) {
      console.error('HorsePay Auth Error:', data)
      throw new Error('Failed to authenticate with HorsePay')
    }

    return data.access_token
  }

  static async createOrder(params: {
    amount: number
    payer_name: string
    client_reference_id: string
    callback_url: string
    phone?: string
  }): Promise<HorsePayOrderResponse> {
    const token = await this.getToken()

    const res = await fetch(`${BASE_URL}/transaction/neworder`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await res.json() as HorsePayOrderResponse
    if (!res.ok || data.status !== 0) {
      console.error('HorsePay Order Error:', data)
      throw new Error(data.message || 'Failed to create HorsePay order')
    }

    return data
  }

  static async checkOrderStatus(externalId: string): Promise<any> {
    const token = await this.getToken()

    const res = await fetch(`${BASE_URL}/api/orders/deposit/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to check order status: ${res.statusText}`)
    }

    return res.json()
  }

  static async checkWithdrawStatus(externalId: string): Promise<any> {
    const token = await this.getToken()

    const res = await fetch(`${BASE_URL}/api/orders/withdraw/${externalId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      throw new Error(`Failed to check withdraw status: ${res.statusText}`)
    }

    return res.json()
  }

  static async createWithdraw(params: {
    amount: number
    pix_key: string
    pix_type: string
    client_reference_id: string
  }): Promise<any> {
    const token = await this.getToken()

    const res = await fetch(`${BASE_URL}/transaction/withdraw`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })

    const data = await res.json()
    if (!res.ok || data.status !== 0) {
      console.error('HorsePay Withdraw Error:', data)
      throw new Error(data.message || 'Failed to process HorsePay withdraw')
    }

    return data
  }
}

export function isHorsePayOrderConfirmed(payload: any) {
  if (!payload) {
    return false
  }

  const truthyConfirmationFlags = [
    payload?.paid,
    payload?.approved,
    payload?.confirmed,
    payload?.data?.paid,
    payload?.data?.approved,
    payload?.data?.confirmed,
  ]

  if (truthyConfirmationFlags.some(value => value === true)) {
    return true
  }

  return collectStatusCandidates(payload).some((value) => {
    if (typeof value === 'number') {
      return value === 1
    }

    const normalized = normalizeHorsePayStatusValue(value)
    if (!normalized) {
      return false
    }

    if (['pending', 'processing', 'waiting', 'created', 'new', 'open'].includes(normalized)) {
      return false
    }

    return ['paid', 'approved', 'confirmed', 'completed', 'success', 'confirmado'].includes(normalized)
  })
}

export function isHorsePayWithdrawApproved(payload: any) {
  if (!payload) {
    return false
  }

  const truthyFlags = [
    payload?.approved,
    payload?.confirmed,
    payload?.completed,
    payload?.success,
    payload?.paid,
    payload?.data?.approved,
    payload?.data?.confirmed,
    payload?.data?.completed,
    payload?.data?.success,
    payload?.data?.paid,
  ]

  if (truthyFlags.some(value => value === true)) {
    return true
  }

  return collectStatusCandidates(payload).some((value) => {
    const normalized = normalizeHorsePayStatusValue(value)
    if (!normalized) {
      return false
    }

    if ([
      'pending',
      'processing',
      'waiting',
      'created',
      'new',
      'open',
      'requested',
      'queued',
      'em_analise',
      'em análise',
      'analyzing',
    ].includes(normalized)) {
      return false
    }

    return [
      'approved',
      'confirmado',
      'confirmed',
      'completed',
      'success',
      'successful',
      'paid',
      'processed',
      'processado',
    ].includes(normalized)
  })
}

export function isHorsePayWithdrawFailed(payload: any) {
  if (!payload) {
    return false
  }

  const failureFlags = [
    payload?.failed,
    payload?.rejected,
    payload?.cancelled,
    payload?.canceled,
    payload?.reverted,
    payload?.refunded,
    payload?.data?.failed,
    payload?.data?.rejected,
    payload?.data?.cancelled,
    payload?.data?.canceled,
    payload?.data?.reverted,
    payload?.data?.refunded,
  ]

  if (failureFlags.some(value => value === true)) {
    return true
  }

  return collectStatusCandidates(payload).some((value) => {
    if (value === false) {
      return true
    }

    const normalized = normalizeHorsePayStatusValue(value)
    if (!normalized) {
      return false
    }

    return [
      'failed',
      'failure',
      'error',
      'rejected',
      'denied',
      'denegado',
      'cancelled',
      'canceled',
      'cancelado',
      'estornado',
      'reverted',
      'refunded',
      'expired',
      'chargeback',
    ].includes(normalized)
  })
}
