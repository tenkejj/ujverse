import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  ChevronDown,
  LockOpen,
  Megaphone,
  ArrowUp,
} from 'lucide-react'
import VersuMark from './VersuMark'
import VersuPortraitPicker from './VersuPortraitPicker'
import { CHAT_MODEL_LABEL, CHAT_PROVIDER_LABEL } from '../../lib/chatModel'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'
import '../../styles/versus-scene.css'

const SUGGESTIONS = [
  { label: 'Komunikaty', Icon: Megaphone },
  { label: 'Rejestracje', Icon: ClipboardList },
  { label: 'Kalendarz', Icon: CalendarDays },
] as const

/** The first message joins the existing conversation via its one-shot handoff. */
export default function VersusEntry() {
  const composer = useRef<HTMLTextAreaElement>(null)
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
    <section className="versus-scene" aria-labelledby="versus-scene-heading">
      <button
        className="versus-scene-persona"
        type="button"
        aria-label="Napisz wiadomość do Versusia"
        onClick={() => composer.current?.focus()}
        onPointerEnter={() => setGreeting(true)}
        onPointerLeave={() => setGreeting(false)}
        onFocus={() => setGreeting(true)}
        onBlur={() => setGreeting(false)}
      >
        <VersuMark
          size={192}
          activity={isFocused ? 'listening' : isGreeting ? 'greeting' : 'idle'}
        />
      </button>
      <header className="versus-scene-greeting">
        <h2 id="versus-scene-heading">Cześć, tu Versuś.</h2>
        <p>Co dziś sprawdzamy na UJ?</p>
      </header>
      <form onSubmit={submit} className="versus-scene-form">
        <label className="sr-only" htmlFor="versus-question">
          Twoje pytanie do Versusia
        </label>
        <div className="versus-scene-composer">
          <textarea
            ref={composer}
            id="versus-question"
            name="question"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Napisz do mnie…"
            value={question}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setQuestion(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`
            }}
            maxLength={4000}
            rows={1}
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
            className="versus-scene-send"
            type="submit"
            disabled={!question.trim()}
            aria-label="Wyślij wiadomość do Versusia"
          >
            <ArrowUp size={22} strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div
          className="versus-scene-suggestions"
          role="group"
          aria-label="Szybkie pytania do Versusia"
        >
          {PUBLIC_CHAT_QUICK_PROMPTS.slice(0, 3).map((prompt, i) => {
            const { label, Icon } = SUGGESTIONS[i]
            return (
              <button type="button" key={prompt} onClick={() => ask(prompt)}>
                <Icon size={16} strokeWidth={1.75} aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      </form>
      <details className="versus-scene-details">
        <summary>
          O Versusiu <ChevronDown size={14} aria-hidden />
        </summary>
        <div className="versus-scene-details-content">
          <p>
            <span>
              {CHAT_MODEL_LABEL} · {CHAT_PROVIDER_LABEL}
            </span>
            <span>
              <LockOpen size={13} aria-hidden /> Dostępny bez logowania
            </span>
          </p>
          <VersuPortraitPicker />
        </div>
      </details>
    </section>
  )
}
