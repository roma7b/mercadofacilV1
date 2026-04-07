import { NextResponse } from 'next/server'
import { getEventRouteBySlug, loadEventPagePublicContentData } from '@/lib/event-page-data'
import { EventRepository } from '@/lib/db/queries/event'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') || '01KND7V3Y9SVF0RCPC68ZYE1R4'

  try {
    const route = await getEventRouteBySlug(id)
    const pageData = await loadEventPagePublicContentData(id, 'pt')
    const rawData = await EventRepository.getEventBySlug(id)
    
    return NextResponse.json({
      success: true,
      routeResult: route,
      pageDataResult: !!pageData,
      rawEvent: rawData
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e?.message || e,
      stack: e?.stack
    })
  }
}

