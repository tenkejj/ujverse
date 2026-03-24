import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

type Props = {
  icon: LucideIcon
  title: string
  subtitle?: string
}

export default function EmptyState({ icon: Icon, title, subtitle }: Props) {
  return (
    <motion.div
      className="flex flex-col items-center py-20 text-slate-400"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-5 w-20 h-20 rounded-full bg-uj-blue/5 dark:bg-white/5 flex items-center justify-center">
        <Icon
          size={38}
          className="text-uj-blue/25 dark:text-white/20"
          strokeWidth={1.5}
        />
      </div>
      <p className="text-[15px] font-semibold text-slate-500 dark:text-gray-400">{title}</p>
      {subtitle && (
        <p className="mt-1 text-[13px] text-slate-400 dark:text-gray-500 max-w-[240px] text-center leading-relaxed">
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
