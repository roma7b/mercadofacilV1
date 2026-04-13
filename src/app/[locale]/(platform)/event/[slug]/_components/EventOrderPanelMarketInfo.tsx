import type { Market } from '@/types'
import EventIconImage from '@/components/EventIconImage'

interface EventOrderPanelMarketInfoProps {
  market: Market | null
}

export default function EventOrderPanelMarketInfo({ market }: EventOrderPanelMarketInfoProps) {
  if (!market) {
    return <></>
  }

  return (
    <div className="mb-1 mt-2">
      <div className="flex items-center gap-3">
        <EventIconImage
          src={market.icon_url}
          alt={market.title}
          sizes="32px"
          containerClassName="size-8 shrink-0 rounded-full"
        />
        <div className="flex flex-col">
           {market.short_title && (
             <span className="line-clamp-1 text-[13px] font-bold text-emerald-500">
               {market.short_title}
             </span>
           )}
           <span className="line-clamp-2 text-[15px] font-bold text-foreground">
             {market.short_title ? market.title : market.title}
           </span>
        </div>
      </div>
    </div>
  )
}
