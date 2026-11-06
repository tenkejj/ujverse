import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, ClipboardList, Megaphone, Send } from 'lucide-react'
import VersuMark from './VersuMark'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'

/** A useful first action, not a second chat implementation or a latency promise. */
export default function VersusEntry() {
  const [question, setQuestion] = useState('')
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
        to="/chat"
        className="versus-entry-brand"
        aria-label="Otwórz rozmowę z Versusiem"
      >
        <VersuMark size={36} />
        <span>
          Versuś <span>AI</span>
        </span>
      </Link>
      <h2 id="versus-entry-heading">W czym Ci pomóc?</h2>
      <p className="versus-entry-description">
        Komunikaty, terminy i wydarzenia. Zapytaj po swojemu.
      </p>
      <form onSubmit={submit} className="versus-entry-form">
        <label className="sr-only" htmlFor="versus-question">
          O co chcesz zapytać Versusia?
        </label>
        <textarea
          id="versus-question"
          name="question"
          autoComplete="off"
          enterKeyHint="send"
          placeholder="Co chcesz wiedzieć o UJ?"
          value={question}
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
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              if (question.trim()) ask(question)
            }
          }}
        />
        <button
          type="submit"
          aria-label="Zapytaj Versusia"
          disabled={!question.trim()}
        >
          <span>Zapytaj</span>
          <Send size={16} aria-hidden />
        </button>
      </form>
      <div
        className="versus-entry-suggestions"
        role="group"
        aria-label="Szybkie pytania do Versusia"
      >
        {PUBLIC_CHAT_QUICK_PROMPTS.slice(0, 3).map((prompt, i) => (
          <button type="button" key={prompt} onClick={() => ask(prompt)}>
            {i === 0 ? (
              <Megaphone size={16} strokeWidth={1.75} aria-hidden />
            ) : i === 1 ? (
              <ClipboardList size={16} strokeWidth={1.75} aria-hidden />
            ) : (
              <CalendarDays size={16} strokeWidth={1.75} aria-hidden />
            )}
            {
              [
                'Co nowego na UJ?',
                'Kiedy rejestracje?',
                'Najbliższe wydarzenia',
              ][i]
            }
          </button>
        ))}
      </div>
      <p className="versus-entry-access">
        Dostępny dla wszystkich, bez logowania.
      </p>
    </section>
  )
}
