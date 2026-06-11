import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, GraduationCap, Loader2, X } from 'lucide-react'
import { toast } from '../../lib/appToast'
import { supabase } from '../../supabaseClient'
import { UJ_DEPARTMENTS } from '../../lib/departments'
import type { Profile } from '../../types'

type StudyMode = 'stacjonarne' | 'niestacjonarne' | 'doktoranckie'

type ProfilePatch = Partial<
  Pick<Profile, 'department' | 'study_program' | 'year_started' | 'study_mode'>
>

type Props = {
  userId: string
  myProfile: Profile | null
  onClose: () => void
  onSaved: (patch: ProfilePatch) => void
}

const STUDY_MODES: ReadonlyArray<{ id: StudyMode; label: string; hint: string }> = [
  { id: 'stacjonarne', label: 'Stacjonarne', hint: 'Dzienne' },
  { id: 'niestacjonarne', label: 'Niestacjonarne', hint: 'Zaoczne / wieczorowe' },
  { id: 'doktoranckie', label: 'Doktoranckie', hint: 'Szkoła doktorska' },
]

const fieldCls =
  'w-full rounded-xl border border-zinc-200 bg-zinc-50/80 p-3 text-zinc-900 outline-none ' +
  'placeholder:text-zinc-400 focus:border-[#1e293b] ' +
  'dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-zinc-500 ' +
  'dark:focus:border-brand-gold-bright'

const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-white/55'

const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#1e293b] px-5 py-2.5 text-sm font-bold ' +
  'text-white transition-colors hover:bg-[#1e293b]/90 ' +
  'dark:bg-brand-gold dark:text-black dark:hover:bg-brand-gold/85 ' +
  'disabled:cursor-not-allowed disabled:opacity-55'

const ghostBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ' +
  'text-zinc-600 transition-colors hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/5'

export default function AulaOnboardingModal({ userId, myProfile, onClose, onSaved }: Props) {
  const currentYear = new Date().getFullYear()
  const years = useMemo(
    () => Array.from({ length: 8 }, (_, i) => currentYear - i),
    [currentYear],
  )

  const [step, setStep] = useState(1)
  const [department, setDepartment] = useState(myProfile?.department ?? '')
  const [program, setProgram] = useState(myProfile?.study_program ?? '')
  const [year, setYear] = useState<number | ''>(myProfile?.year_started ?? '')
  const [mode, setMode] = useState<StudyMode | ''>(myProfile?.study_mode ?? '')
  const [saving, setSaving] = useState(false)

  const canNextStep1 = department.trim() !== '' && program.trim() !== ''
  const canNextStep2 = year !== ''
  const canSubmit = canNextStep1 && canNextStep2 && mode !== ''

  const handleSubmit = async () => {
    if (!canSubmit || saving) return
    setSaving(true)
    const patch: ProfilePatch = {
      department: department.trim(),
      study_program: program.trim(),
      year_started: Number(year),
      study_mode: mode as StudyMode,
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    setSaving(false)
    if (error) {
      toast.error('Nie udało się zapisać danych studiów.')
      return
    }
    toast.success('Witaj w swoim roczniku!')
    onSaved(patch)
  }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Dołącz do rocznika"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border-app bg-bg-card shadow-uj-soft backdrop-blur-md backdrop-saturate-150 dark:shadow-[0_30px_80px_-32px_rgba(0,0,0,0.9)]"
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start gap-3 border-b border-zinc-200 px-5 pb-4 pt-5 dark:border-white/10">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e293b]/[0.06] text-[#1e293b] dark:bg-brand-gold-bright/[0.08] dark:text-brand-gold-bright">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold leading-snug text-fg-primary">Dołącz do swojego rocznika</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg-secondary">
              Podaj kierunek, rok i tryb studiów — trafisz do czatu swojej grupy. Krok {step} z 3.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/5 dark:hover:text-zinc-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="aula-department" className={labelCls}>Wydział</label>
                <select
                  id="aula-department"
                  className={fieldCls}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">Wybierz wydział…</option>
                  {UJ_DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="aula-program" className={labelCls}>Kierunek studiów</label>
                <input
                  id="aula-program"
                  type="text"
                  className={fieldCls}
                  placeholder="np. Informatyka Stosowana"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label htmlFor="aula-year" className={labelCls}>Rok rozpoczęcia studiów</label>
              <select
                id="aula-year"
                className={fieldCls}
                value={year}
                onChange={(e) => setYear(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Wybierz rok…</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                Rok, w którym zacząłeś/aś te studia (np. rekrutacja).
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              <span className={labelCls}>Tryb studiów</span>
              {STUDY_MODES.map((m) => {
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      active
                        ? 'border-[#1e293b] bg-[#1e293b]/[0.05] dark:border-brand-gold-bright dark:bg-brand-gold-bright/[0.08]'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-white/10 dark:hover:border-white/20'
                    }`}
                  >
                    <span className="text-sm font-semibold text-zinc-900 dark:text-white">{m.label}</span>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{m.hint}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-zinc-200 px-5 py-4 dark:border-white/10">
          {step > 1 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className={ghostBtnCls}>
              <ArrowLeft size={16} /> Wstecz
            </button>
          ) : (
            <span />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 ? !canNextStep1 : !canNextStep2}
              className={primaryBtnCls}
            >
              Dalej <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || saving}
              className={primaryBtnCls}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : null}
              {saving ? 'Zapisuję…' : 'Dołącz do rocznika'}
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  )
}
