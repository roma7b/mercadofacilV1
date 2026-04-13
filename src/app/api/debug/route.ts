import { NextResponse } from 'next/server'
 
export const dynamic = 'force-dynamic'
import { EventRepository } from '@/lib/db/queries/event'

export async function GET() {
  const event = await EventRepository.getEventBySlug('poly-wiep0-1775454327094')
  return NextResponse.json(event)
}
