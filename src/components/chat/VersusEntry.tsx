import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  ChevronDown,
  LockOpen,
  Megaphone,
  Send,
} from 'lucide-react'
import VersuMark from './VersuMark'
import VersuPortraitPicker from './VersuPortraitPicker'
import { CHAT_MODEL_LABEL, CHAT_PROVIDER_LABEL } from '../../lib/chatModel'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'

const SUGGESTIONS = [
  { label: 'Komunikaty', Icon: Megaphone },
  { label: 'Rejestracje', Icon: ClipboardList },
  { label: 'Kalendarz', Icon: CalendarDays },
] as const

/** A useful first action, not a second chat implementation or a latency promise. */
export default function VersusEntry() {
  const [question, setQuestion] = useState('')
  const [isFocused, setFocused] = useState(false)
  const [isGreeting, setGreeting] = useState(false)
  const navigate = useNavigate()
  const ask = (prompt: string) =>
    navigate('/chat', { state: versusEntryState(prompt.trim()) })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (question.trim()) ask(question)
  }
  return (
    <section className="versus-entry" aria-labelledby="versus-entry-heading">
      <Link
        className="versus-entry-persona"
        to="/chat"
        aria-label="Otwórz rozmowę z Versusiem, asystentem AI"
        onPointerEnter={() => setGreeting(true)}
        onPointerLeave={() => setGreeting(false)}
        onFocus={() => setGreeting(true)}
        onBlur={() => setGreeting(false)}
      >
        <VersuMark
          size={192}
          activity={isFocused ? 'listening' : isGreeting ? 'greeting' : 'idle'}
        />
      </Link>
      <div className="versus-entry-workspace">
        <header className="versus-entry-header">
          <div className="versus-entry-title-row">
            <Link to="/chat" className="versus-entry-name">
              Versuś{' '}
              <span>
                {CHAT_MODEL_LABEL} · {CHAT_PROVIDER_LABEL}
              </span>
              <ArrowUpRight size={14} aria-hidden />
            </Link>
            <span className="versus-entry-access">
              <LockOpen size={13} aria-hidden /> Bez logowania
            </span>
          </div>
          <h2 id="versus-entry-heading">Co mogę dla Ciebie sprawdzić?</h2>
        </header>
        <form onSubmit={submit} className="versus-entry-form">
          <label className="sr-only" htmlFor="versus-question">
            Twoje pytanie do Versusia
          </label>
          <div className="versus-entry-input">
            <textarea
              id="versus-question"
              name="question"
              autoComplete="off"
              enterKeyHint="send"
              placeholder="O co chcesz zapytać?"
              value={question}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setQuestion(e.target.value)
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`
              }}
              maxLength={4000}
              rows={3}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  event.keyCode !== 229
                ) {
                  event.preventDefault()
                  if (question.trim()) ask(question)
                }
              }}
            />
            <button
              className="versus-entry-submit"
              type="submit"
              disabled={!question.trim()}
              aria-label="Zapytaj Versusia"
            >
              <span>Zapytaj</span>
              <Send size={18} aria-hidden />
            </button>
          </div>
          <div className="versus-entry-actions">
            <div
              className="versus-entry-suggestions"
              role="group"
              aria-label="Szybkie pytania do Versusia"
            >
              {PUBLIC_CHAT_QUICK_PROMPTS.slice(0, 3).map((prompt, i) => {
                const { label, Icon } = SUGGESTIONS[i]
                return (
                  <button
                    type="button"
                    key={prompt}
                    onClick={() => ask(prompt)}
                  >
                    <Icon size={16} strokeWidth={1.75} aria-hidden />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </form>
      </div>
      <details className="versus-entry-portrait-settings">
        <summary>
          Portret w rozmowie <ChevronDown size={14} aria-hidden />
        </summary>
        <VersuPortraitPicker />
      </details>
    </section>
  )
}
