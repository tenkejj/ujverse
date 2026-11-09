import { useSyncExternalStore, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Megaphone,
  Send,
} from 'lucide-react'
import VersuMark from './VersuMark'
import VersuPortraitPicker from './VersuPortraitPicker'
import { CHAT_MODEL_LABEL, CHAT_PROVIDER_LABEL } from '../../lib/chatModel'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'
import {
  getUserPreferences,
  subscribePreferences,
  type VersuPortraitChoice,
} from '../../lib/userPreferences'

const SUGGESTIONS = [
  { label: 'Nowe komunikaty', Icon: Megaphone },
  { label: 'Rejestracje', Icon: ClipboardList },
  { label: 'Ten tydzień', Icon: CalendarDays },
] as const

const PORTRAIT_FACE: Record<VersuPortraitChoice, string> = {
  classic: 'face-idle',
  curious: 'face-listening',
  scholar: 'face-thinking',
}

const readPortrait = () => getUserPreferences().versusPortrait
const serverPortrait = (): VersuPortraitChoice => 'classic'

/** A useful first action, not a second chat implementation or a latency promise. */
export default function VersusEntry() {
  const [question, setQuestion] = useState('')
  const [isFocused, setFocused] = useState(false)
  const [isGreeting, setGreeting] = useState(false)
  const navigate = useNavigate()
  const portrait = useSyncExternalStore(
    subscribePreferences,
    readPortrait,
    serverPortrait,
  )

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
          size={280}
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
          </div>
          <h2 id="versus-entry-heading">Co sprawdzić na UJ?</h2>
        </header>

        <form onSubmit={submit} className="versus-entry-form">
          <label className="sr-only" htmlFor="versus-question">
            Twoje pytanie do Versusia
          </label>

          <div className="versus-entry-input versus-entry-input--with-portrait">
            <details className="versus-entry-portrait-settings">
              <summary
                aria-label="Wybierz wygląd Versusia w rozmowie"
                title="Wygląd Versusia"
              >
                <img
                  src={`/versus/${PORTRAIT_FACE[portrait]}.png?v=portrait1`}
                  alt=""
                  width={28}
                  height={28}
                  draggable={false}
                  className="versus-entry-portrait-face"
                />
                <ChevronDown size={14} aria-hidden />
              </summary>
              <VersuPortraitPicker />
            </details>

            <textarea
              id="versus-question"
              name="question"
              autoComplete="off"
              enterKeyHint="send"
              placeholder="Komunikat, rejestracja, termin…"
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
              aria-label="Wyślij pytanie do Versusia"
            >
              <span>Wyślij</span>
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
            <p className="versus-entry-access-note">Możesz zacząć bez konta</p>
          </div>
        </form>
      </div>
    </section>
  )
}
