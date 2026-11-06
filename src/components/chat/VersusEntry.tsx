import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Send } from 'lucide-react'
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
      <div className="versus-entry-heading">
        <VersuMark size={32} />
        <div>
          <h2 id="versus-entry-heading">
            Zapytaj Versusia <span>AI</span>
          </h2>
          <p>Masz pytanie o uczelnię? Zacznij tutaj.</p>
        </div>
      </div>
      <form onSubmit={submit} className="versus-entry-form">
        <label className="sr-only" htmlFor="versus-question">
          O co chcesz zapytać Versusia?
        </label>
        <textarea
          id="versus-question"
          name="question"
          autoComplete="off"
          enterKeyHint="send"
          placeholder="Np. kiedy rusza rejestracja na zajęcia?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
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
        <span className="versus-entry-access">Bez logowania</span>
        <button
          type="submit"
          aria-label="Zapytaj Versusia"
          disabled={!question.trim()}
        >
          <span>Wyślij pytanie</span>
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
            {
              [
                'Co nowego na UJ?',
                'Kiedy rejestracje?',
                'Co się dzieje na uczelni?',
              ][i]
            }
          </button>
        ))}
      </div>
      <Link
        className="versus-entry-open"
        to="/chat"
        aria-label="Otwórz rozmowę z Versusiem"
      >
        Otwórz czat <ArrowUpRight size={15} aria-hidden />
      </Link>
    </section>
  )
}
