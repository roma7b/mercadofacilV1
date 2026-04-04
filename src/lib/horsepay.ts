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
        Authorization: `Bearer ${token}`,
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
        Authorization: `Bearer ${token}`,
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
