import { motion } from 'framer-motion'
import Login from './components/auth/Login.tsx'

export default function Auth() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-start overflow-hidden bg-black bg-gradient-to-b from-black via-neutral-950 to-black pt-[15vh] p-4">
      <div
        className="pointer-events-none absolute -left-1/4 top-1/4 h-[min(50vw,28rem)] w-[min(50vw,28rem)] rounded-full bg-amber-600/15 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-1/5 bottom-1/4 h-[min(45vw,24rem)] w-[min(45vw,24rem)] rounded-full bg-amber-900/25 blur-[100px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-700/10 blur-3xl"
        aria-hidden
      />

      <motion.div
        className="relative z-10 flex w-full max-w-md flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          aria-hidden
          style={{
            maskImage: 'url(/logo.png)',
            WebkitMaskImage: 'url(/logo.png)',
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            width: '14.5rem',
          }}
          className="mb-12 h-40 shrink-0 bg-[#C5A059] drop-shadow-[0_0_28px_rgba(197,160,89,0.45)]"
        />

        <div className="w-full rounded-3xl border border-[#C5A059]/30 bg-white/5 p-8 text-center backdrop-blur-xl">
          <Login />
        </div>
      </motion.div>
    </div>
  )
}
