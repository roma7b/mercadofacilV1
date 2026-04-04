import { NextResponse } from 'next/server'
import { uploadPublicAsset, getPublicAssetUrl } from '@/lib/storage'
import { UserRepository } from '@/lib/db/queries/user'

export async function POST(request: Request) {
  try {
    // 1. Validar Admin
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Tenta garantir que o bucket existe
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    await supabase.storage.createBucket('imagens', { public: true }).catch(() => {}) // Ignora erro se já existir

    const buffer = await file.arrayBuffer()
    const fileExt = file.name.split('.').pop()
    const fileName = `event_${Date.now()}.${fileExt}`
    const assetPath = `events/${fileName}`

    const { error } = await uploadPublicAsset(assetPath, Buffer.from(buffer), {
      contentType: file.type,
      upsert: true,
    })

    if (error) {
      throw new Error(error)
    }

    const publicUrl = getPublicAssetUrl(assetPath)
    console.log('Upload success:', assetPath, publicUrl)

    return NextResponse.json({ success: true, url: publicUrl, path: assetPath })

  } catch (error: any) {
    console.error('SERVER UPLOAD ERROR:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal Server Error',
      details: error.stack
    }, { status: 500 })
  }
}
