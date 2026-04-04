import { EventRepository } from '../src/lib/db/queries/event'

async function test() {
  const slug = '01KND7V3Y9SVF0RCPC68ZYE1R4'
  console.log('Testing slug:', slug)

  try {
    console.log('1. getEventBySlug...')
    const event = await EventRepository.getEventBySlug(slug)
    console.log('Success!', event.error ? `Error returned: ${event.error}` : 'Found data')
  } catch (e: any) {
    console.error('getEventBySlug THREW:', e?.message || e)
  }

  try {
    console.log('2. getEventRouteBySlug...')
    const route = await EventRepository.getEventRouteBySlug(slug)
    console.log('Success!', route.error ? `Error returned: ${route.error}` : 'Found data')
  } catch (e: any) {
    console.error('getEventRouteBySlug THREW:', e?.message || e)
  }

  try {
    console.log('3. getEventConditionChangeLogBySlug...')
    const log = await EventRepository.getEventConditionChangeLogBySlug(slug)
    console.log('Success!', log.error ? `Error returned: ${log.error}` : 'Found data')
  } catch (e: any) {
    console.error('getEventConditionChangeLogBySlug THREW:', e?.message || e)
  }

  try {
    console.log('4. getSportsEventGroupBySlug...')
    const group = await EventRepository.getSportsEventGroupBySlug(slug)
    console.log('Success!', group.error ? `Error returned: ${group.error}` : 'Found data')
  } catch (e: any) {
    console.error('getSportsEventGroupBySlug THREW:', e?.message || e)
  }
}

test().catch(console.error).then(() => process.exit(0))
