import { NextResponse } from 'next/server'
 
 
import { EventRepository } from '@/lib/db/queries/event'

export const dynamic = "force-dynamic";

export async function GET() {
  const event = await EventRepository.getEventBySlug('poly-wiep0-1775454327094')
  return NextResponse.json(event)
}
