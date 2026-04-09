'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, AlertCircle, Wifi, Cpu, Car, Pencil, X, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Hls from 'hls.js'
import { cn } from '@/lib/utils'

const BASE_URL = (process.env.NEXT_PUBLIC_YOLO_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '')
const API_URL = BASE_URL

const WS_URL = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')
const FALLBACK_STREAM_URL = 'https://34.104.32.249.nip.io/SP055-KM092/stream.m3u8'

const FLASH_DURATION_MS = 1600

interface LiveCameraFeedProps {
  liveId: string
  className?: string
  originalStreamUrl?: string
  onCountUpdate?: (count: number) => void
  onViewModeChange?: (mode: 'live' | 'ia') => void
  isAdmin?: boolean
  showMetrics?: boolean
  metadata?: {
    title?: string
    iconUrl?: string
    mainTag?: string
  }
}

type FeedStatus = 'loading' | 'live' | 'error'
type CalibrateState = 'idle' | 'waiting-p1' | 'waiting-p2'

interface DiagLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface CrossingFlash {
  id: string
  line: DiagLine
  class_name: string
  color: [number, number, number]
  direction: 'down' | 'up'
  showAt: number
  hideAt: number
}

export default function LiveCameraFeed({
  liveId,
  className = '',
  originalStreamUrl,
  onCountUpdate,
  onViewModeChange,
  isAdmin = false,
  showMetrics = false,
  metadata
}: LiveCameraFeedProps) {

  // Se for o mercado de Bitcoin, renderiza o gráfico do TradingView
  if (liveId === 'live-btc-price-v2' || metadata?.title?.toLowerCase().includes('bitcoin')) {
    return (
      <div className={cn("w-full h-[450px] bg-[#131722] rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative", className)}>
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_btc&symbol=BINANCE:BTCUSDT&interval=1&hidesidetoolbar=1&hidesizeadjust=1&hidetoptoolbar=1&hidelegend=1&symboledit=0&saveimage=0&toolbarbg=131722&studies=[]&theme=dark&style=3&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=br&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE:BTCUSDT#%7B%22interval%22%3A%221%22%2C%22range%22%3A%2215m%22%7D`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none" />
      </div>
    )
  }

  const [status, setStatus] = useState<FeedStatus>('live')
  const [showPulse, setShowPulse] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [iaConnected, setIaConnected] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError, setIaError] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(0)
  const iaRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [calibState, setCalibState] = useState<CalibrateState>('idle')
  const [toast, setToast] = useState<string | null>(null)
  
  const IS_PROD = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
  const [viewMode, setViewMode] = useState<'live' | 'ia'>(showMetrics && !IS_PROD ? 'ia' : 'live')

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastCountRef = useRef<number | null>(null)
  const lineRef = useRef<DiagLine>({ x1: 0, y1: 0.45, x2: 1, y2: 0.45 })
  const flashesRef = useRef<CrossingFlash[]>([])
  const calibStateRef = useRef<CalibrateState>('idle')
  const p1Ref = useRef<{ x: number, y: number } | null>(null)
  const mouseRef = useRef<{ x: number, y: number } | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewMode)
    }
  }, [viewMode, onViewModeChange])

  // WebSocket para IA (apenas se showMetrics for true)
  useEffect(() => {
    if (!showMetrics) return

    fetch(`${API_URL}/status/${liveId}`).catch(() => {})

    let ws: WebSocket
    let keepAlive: ReturnType<typeof setInterval>
    let reconnectTimer: ReturnType<typeof setTimeout>
    let reconnectAttempts = 0

    const connectWS = () => {
      ws = new WebSocket(`${WS_URL}/ws/live/${liveId}`)
      wsRef.current = ws

      ws.onopen = () => {
        setIaConnected(true)
        setStatus('live')
        reconnectAttempts = 0
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 5000)
      }

      ws.onmessage = (evt) => {
        if (evt.data === 'pong') return
        try {
          if (status === 'loading') setStatus('live') 
          const ev = JSON.parse(evt.data)
          if (ev.line_x1_pct !== undefined) {
            lineRef.current = {
              x1: ev.line_x1_pct,
              y1: ev.line_y1_pct,
              x2: ev.line_x2_pct,
              y2: ev.line_y2_pct,
            }
          }
          const countValue = ev.total_count
          if (onCountUpdate) onCountUpdate(countValue)
          setTotalCount(countValue)

          if (lastCountRef.current !== null && countValue > lastCountRef.current) {
            setShowPulse(true)
            setTimeout(() => setShowPulse(false), 2200)
          }
          lastCountRef.current = countValue

          if (ev.event === 'crossing') {
            const flash: CrossingFlash = {
              id: `${Date.now()}-${Math.random()}`,
              line: { x1: ev.line_x1_pct, y1: ev.line_y1_pct, x2: ev.line_x2_pct, y2: ev.line_y2_pct },
              class_name: ev.vehicle.class_name,
              color: ev.vehicle.color ?? [0, 255, 80],
              direction: ev.vehicle.direction ?? 'down',
              showAt: Date.now(),
              hideAt: Date.now() + FLASH_DURATION_MS,
            }
            flashesRef.current = [...flashesRef.current, flash]
          }
        } catch { /* ignore */ }
      }

      ws.onclose = () => {
        setIaConnected(false)
        clearInterval(keepAlive)
        reconnectAttempts++
        const delay = Math.min(3000 + reconnectAttempts * 2000, 15000)
        reconnectTimer = setTimeout(connectWS, delay)
      }
    }

    connectWS()
    return () => {
      ws?.close()
      clearInterval(keepAlive)
      clearTimeout(reconnectTimer)
    }
  }, [liveId, onCountUpdate, showMetrics])

  // HLS Video Stream
  useEffect(() => {
    const streamToLoad = originalStreamUrl || FALLBACK_STREAM_URL

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, maxBufferLength: 20, manifestLoadingTimeOut: 8000 })
      hlsRef.current = hls
      hls.loadSource(streamToLoad)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[DEBUG_STREAM] HLS Manifest Parsed for:', streamToLoad)
        video.play().catch(e => console.error('[DEBUG_STREAM] Play failed:', e))
        setStatus('live')
        setImgError(false)
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
          else {
            hls.destroy()
            setStatus('error')
            setImgError(true)
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamToLoad
      video.addEventListener('loadedmetadata', () => {
        video.play()
        setStatus('live')
      })
      video.addEventListener('error', () => setImgError(true))
    }

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [originalStreamUrl])

  return (
    <div className={`flex flex-col bg-zinc-950 border border-zinc-800/50 rounded-2xl overflow-hidden ${className}`}>
      <div className="relative flex-grow overflow-hidden group">
        {imgError ? (
          <div className="w-full aspect-video flex flex-col items-center justify-center bg-zinc-900 gap-3">
            <AlertCircle size={32} className="text-rose-500" />
            <p className="text-xs font-bold text-white">Fluxo Indisponível no Momento</p>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white text-black text-[10px] font-black rounded-lg">
              Tentar Novamente
            </button>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <video
              ref={videoRef}
              className="w-full aspect-video object-contain bg-black"
              playsInline
              muted
              autoPlay
              poster="https://images.unsplash.com/photo-1545147986-a9d6f210df77?q=80&w=640&auto=format&fit=crop"
            />
          </div>
        )}

        {/* Badges de Status */}
        <div className="absolute top-2 left-2 flex items-center gap-2 z-10 pointer-events-none">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full border border-white/10">
            <Wifi size={9} className="text-emerald-400 animate-pulse" />
            <span className="text-[8px] font-black text-white uppercase tracking-widest">
              AO VIVO
            </span>
          </div>
          {showMetrics && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur px-2 py-1 rounded-full border border-white/10">
              <Cpu size={9} className={iaConnected ? 'text-amber-400 animate-pulse' : 'text-zinc-500'} />
              <span className="text-[8px] font-black text-zinc-300 uppercase tracking-widest">
                {iaConnected ? 'IA Online' : 'IA Offline'}
              </span>
            </div>
          )}
        </div>

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-50">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Roda-pé de Contagem (Opcional) */}
      {showMetrics && (
        <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/50 border-t border-zinc-800/80">
          <div className="flex flex-col">
             <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
               Análise de Tráfego
             </span>
             <span className="text-xs text-white/80 font-medium">Contagem por IA (YOLOv8)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs font-bold tracking-widest uppercase">TOTAL</span>
            <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-1 rounded-lg">
               <span className="text-2xl font-mono text-emerald-400 tracking-tighter">
                  {totalCount}
               </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
