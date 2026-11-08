import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  LockOpen,
  Megaphone,
  Send,
} from 'lucide-react'
import VersuMark from './VersuMark'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'
import BaseCard from '../ui/BaseCard'

const SUGGESTIONS = [
  { label: 'Co nowego?', Icon: Megaphone },
  { label: 'Kiedy rejestracje?', Icon: ClipboardList },
  { label: 'Co w kalendarzu?', Icon: CalendarDays },
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
    <BaseCard
      as="section"
      className="versus-entry"
      aria-labelledby="versus-entry-heading"
    >
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
          size={112}
          activity={isFocused ? 'listening' : isGreeting ? 'greeting' : 'idle'}
        />
        <strong>
          Versuś <span>AI</span>
        </strong>
        <span className="versus-entry-open">
          Otwórz czat <ArrowUpRight size={14} aria-hidden />
        </span>
      </Link>
      <header className="versus-entry-header">
        <div className="versus-entry-title-row">
          <h2 id="versus-entry-heading">Zapytaj o sprawy na UJ</h2>
          <span className="versus-entry-access">
            <LockOpen size={14} aria-hidden /> Bez logowania
          </span>
        </div>
        <p className="versus-entry-description">
          Komunikaty, rejestracje i wydarzenia. Pomogę Ci znaleźć konkrety.
        </p>
      </header>
      <form onSubmit={submit} className="versus-entry-form">
        <label htmlFor="versus-question">Twoje pytanie</label>
        <div className="versus-entry-input">
          <textarea
            id="versus-question"
            name="question"
            autoComplete="off"
            enterKeyHint="send"
            placeholder="Np. kiedy ruszają rejestracje na zajęcia?"
            value={question}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              setQuestion(e.target.value)
              e.currentTarget.style.height = 'auto'
              e.currentTarget.style.height = `${Math.min(160, e.currentTarget.scrollHeight)}px`
            }}
            maxLength={4000}
            rows={2}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                if (question.trim()) ask(question)
              }
            }}
          />
        </div>
        <div className="versus-entry-actions">
          <button
            className="versus-entry-submit"
            type="submit"
            disabled={!question.trim()}
          >
            Zapytaj Versusia
            <Send size={16} aria-hidden />
          </button>
          <div
            className="versus-entry-suggestions"
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
        </div>
      </form>
    </BaseCard>
  )
}
