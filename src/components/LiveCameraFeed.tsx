'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, AlertCircle, Wifi, Cpu, Car, Pencil, X, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import Hls from 'hls.js'
import { cn } from '@/lib/utils'

const BASE_URL = process.env.NEXT_PUBLIC_YOLO_SERVICE_URL || 'http://localhost:8000'
const API_URL = BASE_URL.replace(/\/$/, '')
const WS_URL = API_URL.replace(/^http/, 'ws')

const FLASH_DURATION_MS = 1600

interface LiveCameraFeedProps {
  liveId: string
  className?: string
  originalStreamUrl?: string
  onCountUpdate?: (count: number) => void
  onViewModeChange?: (mode: 'live' | 'ia') => void
  isAdmin?: boolean
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
}: LiveCameraFeedProps) {

  // Se for o mercado de Bitcoin, renderiza o gráfico do TradingView
  if (liveId === 'live-btc-price-v2') {
    return (
      <div className={cn("w-full h-[450px] bg-[#131722] rounded-2xl overflow-hidden border border-white/5 shadow-2xl relative", className)}>
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_btc&symbol=BINANCE:BTCUSDT&interval=1&hidesidetoolbar=1&hidetoptoolbar=1&hidelegend=1&symboledit=0&saveimage=0&toolbarbg=131722&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&locale=br&utm_source=localhost&utm_medium=widget&utm_campaign=chart&utm_term=BINANCE:BTCUSDT#%7B%22interval%22%3A%221%22%2C%22range%22%3A%2215m%22%7D`}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
        {/* Camada invisível para evitar que o usuário saia arrastando sem querer (foco passivo) */}
        <div className="absolute inset-0 z-10 pointer-events-none" />
      </div>
    )
  }
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [showPulse, setShowPulse] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [iaConnected, setIaConnected] = useState(false)
  const [iaLoading, setIaLoading] = useState(false)
  const [iaError, setIaError] = useState(false)
  const [totalCount, setTotalCount] = useState<number>(0)
  const iaRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [calibState, setCalibState] = useState<CalibrateState>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'live' | 'ia'>('ia')

  useEffect(() => {
    if (onViewModeChange) {
      onViewModeChange(viewMode)
    }
  }, [viewMode, onViewModeChange])

  // Reseta estado da IA ao entrar no modo IA
  useEffect(() => {
    if (viewMode === 'ia') {
      setIaLoading(true)
      setIaError(false)
    }
  }, [viewMode])

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
    let raf: number
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const resize = () => {
      const rect = videoRef.current?.getBoundingClientRect()
      if (rect && (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height))) {
        canvas.width = Math.round(rect.width)
        canvas.height = Math.round(rect.height)
      }
    }

    const draw = () => {
      resize()
      const cw = canvas.width
      const ch = canvas.height
      const now = Date.now()
      ctx.clearRect(0, 0, cw, ch)

      const cs = calibStateRef.current

      if (cs === 'idle') {
        const { x1, y1, x2, y2 } = lineRef.current
        const lx1 = x1 * cw
        const ly1 = y1 * ch
        const lx2 = x2 * cw
        const ly2 = y2 * ch

        ctx.beginPath()
        ctx.moveTo(lx1, ly1)
        ctx.lineTo(lx2, ly2)
        ctx.lineWidth = 2.5
        ctx.strokeStyle = '#00FF50'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#00FF50'
        ctx.stroke()
        ctx.shadowBlur = 0

        ctx.fillStyle = 'rgba(0,255,80,0.85)'
        ctx.font = 'bold 10px monospace'
        ctx.fillText('LINHA VIRTUAL IA', lx1 + 6, ly1 - 6)

        ;([[lx1, ly1], [lx2, ly2]] as number[][]).forEach((p) => {
          const [px, py] = p
          if (px === undefined || py === undefined) return
          ctx.beginPath()
          ctx.arc(px, py, 4, 0, Math.PI * 2)
          ctx.fillStyle = '#00FF50'
          ctx.fill()
        })
      }

      if (cs !== 'idle') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)'
        ctx.fillRect(0, 0, cw, ch)

        const msg = cs === 'waiting-p1'
          ? '✦  Clique no PONTO 1 da linha'
          : '✦  Clique no PONTO 2 da linha'
        ctx.fillStyle = '#FACC15'
        ctx.font = `bold ${Math.round(13 * Math.min(cw / 400, 1))}px monospace`
        ctx.fillText(msg, 12, 22)

        if (p1Ref.current) {
          const px = p1Ref.current.x * cw
          const py = p1Ref.current.y * ch
          ctx.beginPath()
          ctx.arc(px, py, 6, 0, Math.PI * 2)
          ctx.fillStyle = '#FACC15'
          ctx.fill()
          ctx.strokeStyle = '#000'
          ctx.lineWidth = 1
          ctx.stroke()
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 9px monospace'
          ctx.fillText('P1', px + 9, py + 4)
        }

        if (p1Ref.current && mouseRef.current && cs === 'waiting-p2') {
          ctx.beginPath()
          ctx.moveTo(p1Ref.current.x * cw, p1Ref.current.y * ch)
          ctx.lineTo(mouseRef.current.x * cw, mouseRef.current.y * ch)
          ctx.strokeStyle = '#FACC15'
          ctx.lineWidth = 2
          ctx.setLineDash([6, 4])
          ctx.stroke()
          ctx.setLineDash([])
        }
      }

      const active = flashesRef.current.filter(f => f.showAt <= now && now - f.showAt < FLASH_DURATION_MS)

      for (const flash of active) {
        const elapsed = now - flash.showAt
        const progress = Math.min(elapsed / FLASH_DURATION_MS, 1)
        const alpha = progress < 0.12 ? progress / 0.12 : progress > 0.6 ? 1 - (progress - 0.6) / 0.4 : 1
        if (alpha <= 0) {
          continue
        }

        const lx1 = flash.line.x1 * cw
        const ly1 = flash.line.y1 * ch
        const lx2 = flash.line.x2 * cw
        const ly2 = flash.line.y2 * ch
        const [r, g, b] = flash.color

        ctx.beginPath()
        ctx.moveTo(lx1, ly1)
        ctx.lineTo(lx2, ly2)
        ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.lineWidth = 4
        ctx.shadowBlur = 18
        ctx.shadowColor = `rgb(${r},${g},${b})`
        ctx.stroke()
        ctx.shadowBlur = 0

        const mx = (lx1 + lx2) / 2
        const my = (ly1 + ly2) / 2
        const arrow = flash.direction === 'down' ? '↓' : '↑'
        const label = `${arrow}  ${flash.class_name}  +1`
        ctx.font = `bold ${Math.round(14 * Math.min(cw / 400, 1))}px sans-serif`
        const tw = ctx.measureText(label).width
        ctx.fillStyle = `rgba(0,0,0,${alpha * 0.6})`
        ctx.beginPath()
        // @ts-ignore
        ctx.roundRect(mx - tw / 2 - 10, my - 12, tw + 20, 22, 6)
        ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`
        ctx.fillText(label, mx - tw / 2, my + 6)
      }

      flashesRef.current = flashesRef.current.filter(
        f => f.showAt > now || now - f.showAt < FLASH_DURATION_MS + 300,
      )

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (calibStateRef.current === 'idle') {
      return
    }
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }, [])

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (calibStateRef.current === 'idle') {
      return
    }
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width
    const py = (e.clientY - rect.top) / rect.height

    if (calibStateRef.current === 'waiting-p1') {
      p1Ref.current = { x: px, y: py }
      calibStateRef.current = 'waiting-p2'
      setCalibState('waiting-p2')
    }
    else if (calibStateRef.current === 'waiting-p2' && p1Ref.current) {
      const x1 = Math.round(p1Ref.current.x * 640)
      const y1 = Math.round(p1Ref.current.y * 480)
      const x2 = Math.round(px * 640)
      const y2 = Math.round(py * 480)

      fetch(`${API_URL}/set-line/${liveId}/${x1}/${y1}/${x2}/${y2}`)
        .then(r => r.json())
        .then(() => {
          lineRef.current = { x1: x1 / 640, y1: y1 / 480, x2: x2 / 640, y2: y2 / 480 }
          showToast('✅ Linha calibrada com sucesso!')
        })
        .catch(() => showToast('❌ Erro ao salvar a linha'))

      calibStateRef.current = 'idle'
      setCalibState('idle')
      p1Ref.current = null
      mouseRef.current = null
    }
  }, [liveId, showToast])

  const startCalibration = useCallback(() => {
    p1Ref.current = null
    mouseRef.current = null
    calibStateRef.current = 'waiting-p1'
    setCalibState('waiting-p1')
  }, [])

  const cancelCalibration = useCallback(() => {
    calibStateRef.current = 'idle'
    setCalibState('idle')
    p1Ref.current = null
    mouseRef.current = null
  }, [])

  useEffect(() => {
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
        reconnectAttempts = 0
        keepAlive = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping')
          }
        }, 5000)
      }

      ws.onmessage = (evt) => {
        if (evt.data === 'pong') {
          return
        }
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

          const countValue = ev.total_count
          if (onCountUpdate) {
            onCountUpdate(countValue)
          }
          setTotalCount(countValue)

          if (lastCountRef.current !== null && countValue > lastCountRef.current) {
            setShowPulse(true)
            setTimeout(() => setShowPulse(false), 2200)
          }
          lastCountRef.current = countValue

          if (ev.event === 'crossing') {
            const flash: CrossingFlash = {
              id: `${Date.now()}-${Math.random()}`,
              line: {
                x1: ev.line_x1_pct,
                y1: ev.line_y1_pct,
                x2: ev.line_x2_pct,
                y2: ev.line_y2_pct,
              },
              class_name: ev.vehicle.class_name,
              color: ev.vehicle.color ?? [0, 255, 80],
              direction: ev.vehicle.direction ?? 'down',
              showAt: Date.now(),
              hideAt: Date.now() + FLASH_DURATION_MS,
            }
            flashesRef.current = [...flashesRef.current, flash]
          }
        }
        catch { /* ignore */ }
      }

      ws.onclose = () => {
        setIaConnected(false)
        clearInterval(keepAlive)
        reconnectAttempts++
        const delay = Math.min(3000 + reconnectAttempts * 2000, 15000)
        reconnectTimer = setTimeout(connectWS, delay)
      }

      ws.onerror = () => {}
    }

    connectWS()

    return () => {
      ws?.close()
      clearInterval(keepAlive)
      clearTimeout(reconnectTimer)
    }
  }, [liveId, onCountUpdate])

  useEffect(() => {
    if (!videoRef.current || !originalStreamUrl) {
      return
    }
    const video = videoRef.current

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, maxBufferLength: 20, manifestLoadingTimeOut: 8000 })
      hlsRef.current = hls
      hls.loadSource(originalStreamUrl)
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
          }
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError()
          }
          else {
            hls.destroy()
            setStatus('error')
            setImgError(true)
          }
        }
      })
    }
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = originalStreamUrl
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
        <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 gap-3">
          <AlertCircle size={32} className="text-rose-500" />
          <p className="text-xs font-bold text-white">Câmera Temporariamente Indisponível</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black text-[10px] font-black rounded-lg"
          >
            Tentar Novamente
          </button>
        </div>
      ) : (
        <div className="w-full h-full relative">
          {viewMode === 'live' ? (
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              autoPlay
              poster="https://images.unsplash.com/photo-1545147986-a9d6f210df77?q=80&w=640&auto=format&fit=crop"
            />
          ) : (
            <div className="relative w-full h-full">
              {iaLoading && !iaError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 gap-3">
                  <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Conectando à IA...</p>
                  <p className="text-[9px] text-zinc-500">Aguardando primeiros frames do YOLO</p>
                </div>
              )}
              {iaError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 z-10 gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-rose-500 flex items-center justify-center">
                    <span className="text-rose-500 text-lg">!</span>
                  </div>
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">IA Indisponível</p>
                  <button
                    onClick={() => { setIaError(false); setIaLoading(true) }}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[9px] font-black rounded-full transition-all"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}
              {!iaError && (
                <img
                  key={iaLoading ? 'loading' : 'loaded'}
                  src={`${API_URL}/video-feed/${liveId}?t=${Date.now()}`}
                  className="w-full h-full object-cover"
                  alt="AI Perspective"
                  onError={() => {
                    // Tenta reconectar automaticamente até 3x enquanto a câmera inicializa
                    if (iaRetryRef.current) clearTimeout(iaRetryRef.current)
                    iaRetryRef.current = setTimeout(() => {
                      setIaLoading(false)
                      setIaError(true)
                    }, 8000)
                  }}
                  onLoad={() => {
                    if (iaRetryRef.current) clearTimeout(iaRetryRef.current)
                    setIaLoading(false)
                    setIaError(false)
                    setStatus('live')
                  }}
                />
              )}
            </div>
          )}

          {viewMode === 'live' && (
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full z-10 ${calibState !== 'idle' ? 'cursor-crosshair pointer-events-auto' : 'pointer-events-none'}`}
              onMouseMove={handleCanvasMouseMove}
              onClick={handleCanvasClick}
            />
          )}
        </div>
      )}

      {calibState === 'idle' && (
        <button
          onClick={() => window.location.reload()}
          className="absolute bottom-3 right-3 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full backdrop-blur-sm border border-white/10 z-20 transition-all opacity-0 group-hover:opacity-100"
          title="Reiniciar Player"
        >
          <RefreshCw size={13} />
        </button>
      )}

      <div className="absolute bottom-3 left-3 z-30 flex gap-2">
        <div
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-black transition-all border shadow-lg bg-emerald-600 border-emerald-400 text-white animate-pulse"
        >
          <Cpu className="w-3.5 h-3.5" />
          VISÃO IA (SINCRO)
        </div>

        {isAdmin && calibState === 'idle' && (
          <button
            onClick={startCalibration}
            className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg text-[10px] font-black transition-all shadow-lg"
          >
            <Pencil className="w-3.5 h-3.5" />
            Calibrar Linha
          </button>
        )}
      </div>

      {isAdmin && calibState !== 'idle' && (
        <button
          onClick={cancelCalibration}
          className="absolute bottom-3 left-3 flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/90 hover:bg-rose-600 text-white text-[10px] font-black rounded-lg z-20 transition-all shadow-lg"
        >
          <X size={11} />
          Cancelar
        </button>
      )}

      <AnimatePresence>
        {showPulse && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="absolute top-2 right-2 z-30 flex items-center gap-1.5 bg-rose-600 text-white font-black text-[10px] px-2.5 py-1 rounded-full shadow-lg border border-rose-400/50 pointer-events-none"
          >
            <Car size={10} />
            +1 VEÍCULO
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-zinc-900/95 border border-zinc-700 text-white text-[11px] font-bold px-4 py-2 rounded-full shadow-xl pointer-events-none whitespace-nowrap"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-2 left-2 flex items-center gap-2 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 px-2 py-1 rounded-full shadow border border-zinc-700">
          <Wifi size={10} className={status === 'live' ? 'text-emerald-400 animate-pulse' : 'text-zinc-500'} />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">
            {status === 'live' ? 'DER-SP' : 'Conectando'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur px-2 py-1 rounded-full border border-white/10">
          <Cpu size={10} className={iaConnected ? 'text-amber-400 animate-pulse' : 'text-zinc-500'} />
          <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest">
            {iaConnected ? 'IA Online' : 'IA Offline'}
          </span>
        </div>
      </div>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-50">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      )}
      </div>

      {/* Roda-pé de Contagem em Tempo Real (fora do video) */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/50 border-t border-zinc-800/80">
        <div className="flex flex-col">
           <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
             Tráfego Atual
           </span>
           <span className="text-xs text-white/80 font-medium">Contagem por IA (YOLOv8)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-zinc-500 text-xs font-bold tracking-widest">TOTAL</span>
          <div className="bg-emerald-500/10 border border-emerald-500/30 px-4 py-1 rounded-lg">
             <span className="text-2xl font-mono text-emerald-400 tracking-tighter">
                {totalCount}
             </span>
          </div>
        </div>
      </div>
    </div>
  )
}
