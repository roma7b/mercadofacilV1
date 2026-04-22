'use client'

import Hls from 'hls.js'
import { AlertCircle, Cpu, Wifi } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const BASE_URL = (process.env.NEXT_PUBLIC_YOLO_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '')
const API_URL  = BASE_URL
const WS_URL   = API_URL.replace(/^https/, 'wss').replace(/^http/, 'ws')
const FALLBACK_STREAM_URL = 'https://34.104.32.249.nip.io/SP055-KM092/stream.m3u8'

// Duração do highlight vermelho após cruzamento (ms)
const FLASH_DURATION_MS = 1800

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

interface Detection {
  id: number
  cls: string
  color: [number, number, number]
  x1: number
  y1: number
  x2: number
  y2: number
  crossed: boolean
  conf: number
}

interface CountingLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

type FeedStatus = 'loading' | 'live' | 'error'

export default function LiveCameraFeed({
  liveId,
  className = '',
  originalStreamUrl,
  onCountUpdate,
  showMetrics = false,
  metadata,
}: LiveCameraFeedProps) {
  // Mercado Bitcoin → TradingView
  if (liveId === 'live-btc-price-v2' || metadata?.title?.toLowerCase().includes('bitcoin')) {
    return (
      <div className={cn(`
        relative h-[450px] w-full overflow-hidden rounded-2xl border border-white/5 bg-[#131722] shadow-2xl
      `, className)}>
        <iframe
          src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_btc&symbol=BINANCE:BTCUSDT&interval=1&hidesidetoolbar=1&hidesizeadjust=1&hidetoptoolbar=1&hidelegend=1&symboledit=0&saveimage=0&toolbarbg=131722&studies=[]&theme=dark&style=3&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=br&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE:BTCUSDT#%7B%22interval%22%3A%221%22%2C%22range%22%3A%2215m%22%7D"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
        <div className="pointer-events-none absolute inset-0 z-10" />
      </div>
    )
  }

  const [status,      setStatus]      = useState<FeedStatus>('loading')
  const [imgError,    setImgError]    = useState(false)
  const [iaConnected, setIaConnected] = useState(false)
  const [totalCount,  setTotalCount]  = useState(0)
  const [fpsReal,     setFpsReal]     = useState(0)
  const [showPulse,   setShowPulse]   = useState(false)

  const videoRef        = useRef<HTMLVideoElement>(null)
  const canvasRef       = useRef<HTMLCanvasElement>(null)
  const hlsRef          = useRef<Hls | null>(null)
  const wsRef           = useRef<WebSocket | null>(null)
  const animFrameRef    = useRef<number>(0)
  const detectionsRef   = useRef<Detection[]>([])
  const lineRef         = useRef<CountingLine>({ x1: 0, y1: 0.45, x2: 1, y2: 0.45 })
  const flashTimesRef   = useRef<Map<number, number>>(new Map()) // id → timestamp do cruzamento
  const lastCountRef    = useRef<number | null>(null)

  // ─── Loop de render do canvas ──────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(drawCanvas)
      return
    }

    const vw = video.videoWidth
    const vh = video.videoHeight
    // Sincroniza tamanho do canvas com o elemento <video> renderizado
    const rect = video.getBoundingClientRect()
    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width  = rect.width
      canvas.height = rect.height
    }

    const cw = canvas.width
    const ch = canvas.height
    // Fator de escala levando em conta object-contain (letterbox)
    const scaleX = cw / vw
    const scaleY = ch / vh
    const scale  = Math.min(scaleX, scaleY)
    const offsetX = (cw - vw * scale) / 2
    const offsetY = (ch - vh * scale) / 2

    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, cw, ch)

    const now = Date.now()
    const dets = detectionsRef.current

    // Desenha bounding boxes APENAS para quem está cruzando a linha
    for (const det of dets) {
      // Ignora veículos que não estão na área de contagem/cruzando
      if (!det.crossed) continue

      const x1 = det.x1 * vw * scale + offsetX
      const y1 = det.y1 * vh * scale + offsetY
      const x2 = det.x2 * vw * scale + offsetX
      const y2 = det.y2 * vh * scale + offsetY
      const bw = x2 - x1
      const bh = y2 - y1

      const [r, g, b] = det.color
      const boxColor  = 'rgba(52, 211, 153, 0.9)' // Verde esmeralda para detecção
      const lineWidth = 3

      ctx.strokeStyle = boxColor
      ctx.lineWidth   = lineWidth
      ctx.shadowColor = boxColor
      ctx.shadowBlur  = 12
      ctx.strokeRect(x1, y1, bw, bh)

      // Label
      const label  = `${det.cls} contado`
      const fsize  = Math.max(10, Math.round(canvas.height * 0.018))
      ctx.font     = `bold ${fsize}px monospace`
      const tw     = ctx.measureText(label).width
      const lh     = fsize + 4

      ctx.shadowBlur = 0
      ctx.fillStyle  = 'rgba(52, 211, 153, 0.2)'
      ctx.fillRect(x1, y1, bw, bh) // Preenchimento suave

      ctx.fillStyle  = 'rgba(0,0,0,0.8)'
      ctx.fillRect(x1, y1 - lh, tw + 8, lh)

      ctx.fillStyle = '#10B981' // Texto verde
      ctx.fillText(label, x1 + 4, y1 - 4)
    }

    // Desenha linha de contagem
    const line  = lineRef.current
    const lx1   = line.x1 * vw * scale + offsetX
    const ly1   = line.y1 * vh * scale + offsetY
    const lx2   = line.x2 * vw * scale + offsetX
    const ly2   = line.y2 * vh * scale + offsetY

    ctx.shadowBlur  = 8
    ctx.shadowColor = '#00FF50'
    ctx.strokeStyle = '#00FF50'
    ctx.lineWidth   = 2.5
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.moveTo(lx1, ly1)
    ctx.lineTo(lx2, ly2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.shadowBlur = 0

    animFrameRef.current = requestAnimationFrame(drawCanvas)
  }, [])

  // ─── WebSocket (dados da IA) ───────────────────────────────────────────────
  useEffect(() => {
    if (!showMetrics) return

    let ws: WebSocket
    let keepAlive:      ReturnType<typeof setInterval>
    let reconnectTimer: ReturnType<typeof setTimeout>
    let reconnectAttempts = 0

    const connect = () => {
      const cleanLiveId = liveId.replace(/^live_live-/, 'live-').replace(/^live_/, 'live-')
      ws = new WebSocket(`${WS_URL}/ws/live/${cleanLiveId}`)
      wsRef.current = ws

      ws.onopen = () => {
        setIaConnected(true)
        setStatus('live')
        reconnectAttempts = 0
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send('ping')
        }, 5000)
      }

      ws.onmessage = (evt) => {
        if (evt.data === 'pong') return
        try {
          const ev = JSON.parse(evt.data)

          if (ev.line_x1_pct !== undefined) {
            lineRef.current = {
              x1: ev.line_x1_pct,
              y1: ev.line_y1_pct,
              x2: ev.line_x2_pct,
              y2: ev.line_y2_pct,
            }
          }

          if (Array.isArray(ev.detections)) {
            detectionsRef.current = ev.detections as Detection[]
          }

          const count = ev.total_count ?? 0
          if (onCountUpdate) onCountUpdate(count)
          setTotalCount(count)

          if (ev.fps !== undefined) setFpsReal(ev.fps)

          if (lastCountRef.current !== null && count > lastCountRef.current) {
            setShowPulse(true)
            setTimeout(() => setShowPulse(false), 2000)
          }
          lastCountRef.current = count

          // Registra timestamp do cruzamento para flash visual
          if (ev.event === 'crossing' && ev.vehicle) {
            // A detecção que cruzou está marcada com `crossed: true` em ev.detections
            const crossed = (ev.detections as Detection[] | undefined)?.find(d => d.crossed)
            if (crossed) {
              flashTimesRef.current.set(crossed.id, Date.now())
            }
          }
        }
        catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setIaConnected(false)
        clearInterval(keepAlive)
        reconnectAttempts++
        const delay = Math.min(3000 + reconnectAttempts * 2000, 15000)
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    connect()
    // Inicia loop de canvas
    animFrameRef.current = requestAnimationFrame(drawCanvas)

    return () => {
      ws?.close()
      clearInterval(keepAlive)
      clearTimeout(reconnectTimer)
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [liveId, onCountUpdate, showMetrics, drawCanvas])

  // ─── HLS Video Stream ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!videoRef.current) return
    const video = videoRef.current
    const streamUrl = originalStreamUrl || FALLBACK_STREAM_URL

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker:         true,
        maxBufferLength:      15,
        maxMaxBufferLength:   20,
        manifestLoadingTimeOut: 8000,
        liveSyncDurationCount:  2,
        liveMaxLatencyDurationCount: 4,
      })
      hlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
        setStatus('live')
        setImgError(false)
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          } else {
            hls.destroy()
            setStatus('error')
            setImgError(true)
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
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
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-950 ${className}`}>
      <div className="group relative grow overflow-hidden">

        {imgError
          ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-zinc-900">
                <AlertCircle size={32} className="text-rose-500" />
                <p className="text-xs font-bold text-white">Fluxo Indisponível no Momento</p>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-lg bg-white px-4 py-2 text-2xs font-black text-black"
                >
                  Tentar Novamente
                </button>
              </div>
            )
          : (
              /* Wrapper relativo para sobrepor o canvas ao vídeo */
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                {/* Stream HLS ao vivo */}
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-contain"
                  playsInline
                  muted
                  autoPlay
                  poster="https://images.unsplash.com/photo-1545147986-a9d6f210df77?q=80&w=640&auto=format&fit=crop"
                />

                {/* Canvas overlay com bounding boxes (apenas quando showMetrics=true) */}
                {showMetrics && (
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    style={{ zIndex: 10 }}
                  />
                )}

                {/* Overlay de contagem dentro do vídeo */}
                {showMetrics && iaConnected && (
                  <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-3 pt-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold tracking-widest text-zinc-300/80 uppercase">Contagem Atual</span>
                      <span
                        className={cn(
                          'font-mono text-3xl font-black leading-none text-white transition-all duration-300',
                          showPulse && 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
                        )}
                      >
                        {totalCount}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            )}

        {/* Badges de status */}
        <div className="pointer-events-none absolute top-2 left-2 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-sm">
            <Wifi size={9} className="animate-pulse text-emerald-400" />
            <span className="text-[8px] font-black tracking-widest text-white uppercase">AO VIVO</span>
          </div>

          {showMetrics && (
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1 backdrop-blur-sm">
              <Cpu
                size={9}
                className={iaConnected ? 'animate-pulse text-amber-400' : 'text-zinc-500'}
              />
              <span className="text-[8px] font-black tracking-widest text-zinc-300 uppercase">
                {iaConnected ? `IA • ${fpsReal > 0 ? `${fpsReal} fps` : 'Online'}` : 'IA Offline'}
              </span>
            </div>
          )}
        </div>

        {/* Pulse ao contar */}
        {showPulse && showMetrics && (
          <div
            className="pointer-events-none absolute inset-0 z-20 animate-ping rounded-none border-4 border-emerald-400/60"
            style={{ animationDuration: '0.6s', animationIterationCount: 1 }}
          />
        )}

        {status === 'loading' && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-950">
            <div className="size-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Rodapé de contagem */}
      {showMetrics && (
        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-zinc-900/50 px-5 py-3">
          <div className="flex flex-col">
            <span className="text-2xs font-bold tracking-widest text-zinc-500 uppercase">
              Análise de Tráfego
            </span>
            <span className="text-xs font-medium text-white/80">Contagem por IA (YOLOv8)</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold tracking-widest text-zinc-500 uppercase">TOTAL</span>
            <div
              className={cn(
                'rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 transition-all duration-300',
                showPulse && 'border-emerald-400/80 bg-emerald-400/20 scale-110',
              )}
            >
              <span className="font-mono text-2xl tracking-tighter text-emerald-400">
                {totalCount}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
