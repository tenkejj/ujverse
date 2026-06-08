import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'

/**
 * ImageLightbox — pełnoekranowy widok zdjęcia z blurowanym tłem aplikacji.
 *
 * Sterowanie (PC + mobile):
 *  - kółko myszy / pinch dwoma palcami → zoom (kotwiczony pod kursorem / środkiem palców),
 *  - dwuklik / dwutap → toggle 1× ↔ 2.5×,
 *  - drag (jednym palcem / myszą) → pan, gdy `scale > 1`,
 *  - przyciski toolbara (top-right): +, -, reset, X,
 *  - klik w tło (poza zdjęciem) lub Escape → zamknięcie,
 *  - body scroll lock na czas otwarcia.
 */

const MIN_SCALE = 1
const MAX_SCALE = 5
const ZOOM_STEP = 0.5
const DOUBLE_TAP_SCALE = 2.5

type Props = {
  src: string
  alt?: string
  open: boolean
  onClose: () => void
}

export default function ImageLightbox({ src, alt, open, onClose }: Props) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })

  const containerRef = useRef<HTMLDivElement | null>(null)
  // Refs trzymają „świeży" snapshot stanu dla nasłuchów spoza render-loop
  // (native wheel + handlerów multi-touch, które inaczej łapałyby zamknięty
  // closure po pierwszym mount).
  const scaleRef = useRef(scale)
  const translateRef = useRef(translate)

  useLayoutEffect(() => {
    scaleRef.current = scale
  }, [scale])

  useLayoutEffect(() => {
    translateRef.current = translate
  }, [translate])

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const dragRef = useRef<{
    active: boolean
    startX: number
    startY: number
    baseTx: number
    baseTy: number
    moved: boolean
  }>({
    active: false,
    startX: 0,
    startY: 0,
    baseTx: 0,
    baseTy: 0,
    moved: false,
  })
  const pinchRef = useRef<{
    startDistance: number
    startScale: number
    startMidX: number
    startMidY: number
  } | null>(null)

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  /**
   * Aplikuje nową skalę z opcjonalnym kotwiczeniem na punkcie ekranu
   * (cursor przy kółku, midpoint przy pinchu). Punkt pod kotwicą pozostaje
   * w tym samym miejscu po zoomie — standardowy „pinch-to-zoom around point".
   */
  const applyZoom = useCallback((next: number, anchorX?: number, anchorY?: number) => {
    const cur = scaleRef.current
    const t = translateRef.current
    const newScale = clampScale(next)
    if (newScale === MIN_SCALE) {
      setScale(MIN_SCALE)
      setTranslate({ x: 0, y: 0 })
      return
    }
    if (anchorX !== undefined && anchorY !== undefined && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      // Pozycja kotwicy w „przestrzeni obrazu" (niezniwelowanej skalą).
      const px = (anchorX - cx - t.x) / cur
      const py = (anchorY - cy - t.y) / cur
      setTranslate({
        x: anchorX - cx - px * newScale,
        y: anchorY - cy - py * newScale,
      })
    }
    setScale(newScale)
  }, [])

  // Reset transformacji przy otwarciu / zmianie źródła.
  useEffect(() => {
    if (open) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    }
  }, [open, src])

  // Body scroll lock + zachowanie poprzedniego overflow (nie wymuszamy 'auto').
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Escape → zamknięcie.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // React podpina `onWheel` jako listener pasywny — `preventDefault` w nim
  // nie zadziała (browser i tak przewinie stronę). Dlatego natywny listener
  // z `{ passive: false }` na containerze. Zależność tylko od `open` + stabilny
  // `applyZoom`, więc handler montuje się raz na otwarcie.
  useEffect(() => {
    if (!open) return
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.0025)
      applyZoom(scaleRef.current * factor, e.clientX, e.clientY)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [open, applyZoom])

  if (!open) return null

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values())
      const dx = p2.x - p1.x
      const dy = p2.y - p1.y
      pinchRef.current = {
        startDistance: Math.hypot(dx, dy),
        startScale: scaleRef.current,
        startMidX: (p1.x + p2.x) / 2,
        startMidY: (p1.y + p2.y) / 2,
      }
      dragRef.current.active = false
    } else if (pointersRef.current.size === 1 && scaleRef.current > 1) {
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        baseTx: translateRef.current.x,
        baseTy: translateRef.current.y,
        moved: false,
      }
      try {
        ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
      } catch {
        /* ignore — niektóre przeglądarki potrafią rzucić, gdy element zniknął */
      }
    }
  }

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values()).slice(0, 2)
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const ratio = dist / pinchRef.current.startDistance
      applyZoom(
        pinchRef.current.startScale * ratio,
        pinchRef.current.startMidX,
        pinchRef.current.startMidY,
      )
      return
    }

    if (dragRef.current.active && scaleRef.current > 1) {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      if (Math.hypot(dx, dy) > 4) dragRef.current.moved = true
      setTranslate({
        x: dragRef.current.baseTx + dx,
        y: dragRef.current.baseTy + dy,
      })
    }
  }

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (pointersRef.current.size === 0) {
      dragRef.current.active = false
    }
  }

  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (scaleRef.current === 1) {
      applyZoom(DOUBLE_TAP_SCALE, e.clientX, e.clientY)
    } else {
      applyZoom(1)
    }
  }

  // Klik w tło (poza obrazem i toolbarem) zamyka — ale tylko jeżeli nie był
  // to zakończony drag (gdzie pointer się przesunął >4px).
  const handleBackdropClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (dragRef.current.moved) {
      dragRef.current.moved = false
      return
    }
    if (e.target === e.currentTarget) onClose()
  }

  const stopMouse = (e: ReactMouseEvent) => e.stopPropagation()
  const stopPointer = (e: ReactPointerEvent) => e.stopPropagation()

  const isDragging = dragRef.current.active && dragRef.current.moved

  const toolbarBtnCls =
    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 ' +
    'bg-black/45 text-white backdrop-blur-md transition-colors ' +
    'hover:bg-black/70 active:bg-black/80 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed'

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="image-lightbox"
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pełny widok zdjęcia"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-10000 flex select-none items-center justify-center overflow-hidden bg-black/55 backdrop-blur-xl touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onClick={handleBackdropClick}
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
      >
        <div
          className="absolute right-3 top-3 z-10 flex items-center gap-1.5 sm:right-4 sm:top-4 sm:gap-2"
          onPointerDown={stopPointer}
          onClick={stopMouse}
          onDoubleClick={stopMouse}
        >
          <button
            type="button"
            onClick={() => applyZoom(scaleRef.current - ZOOM_STEP)}
            disabled={scale <= MIN_SCALE}
            aria-label="Pomniejsz"
            className={toolbarBtnCls}
          >
            <ZoomOut size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(scaleRef.current + ZOOM_STEP)}
            disabled={scale >= MAX_SCALE}
            aria-label="Powiększ"
            className={toolbarBtnCls}
          >
            <ZoomIn size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => applyZoom(1)}
            disabled={scale === 1 && translate.x === 0 && translate.y === 0}
            aria-label="Resetuj zoom"
            className={toolbarBtnCls}
          >
            <RotateCcw size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className={toolbarBtnCls}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <img
          src={src}
          alt={alt ?? ''}
          draggable={false}
          onClick={stopMouse}
          onDoubleClick={handleDoubleClick}
          className="max-h-[92vh] max-w-[95vw] object-contain"
          style={{
            transform: `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition:
              isDragging || pinchRef.current
                ? 'none'
                : 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform',
            WebkitUserSelect: 'none',
            userSelect: 'none',
          }}
        />
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
