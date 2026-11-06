import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Send } from 'lucide-react'
import BaseCard from '../ui/BaseCard'
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
    <BaseCard
      as="section"
      className="versus-entry"
      aria-labelledby="versus-entry-heading"
    >
      <div className="versus-entry-heading">
        <VersuMark size={38} />
        <div>
          <h2 id="versus-entry-heading">
            Zapytaj Versusia <span>AI</span>
          </h2>
          <p>Komunikaty, rejestracje i wydarzenia — zapytaj po swojemu.</p>
        </div>
        <Link to="/chat" aria-label="Otwórz rozmowę z Versusiem">
          <ArrowUpRight size={19} aria-hidden />
        </Link>
      </div>
      <form onSubmit={submit} className="versus-entry-form">
        <label className="sr-only" htmlFor="versus-question">
          O co chcesz zapytać Versusia?
        </label>
        <input
          id="versus-question"
          name="question"
          autoComplete="off"
          placeholder="Np. kiedy zaczynają się rejestracje?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={4000}
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
            {
              [
                'Komunikaty z wydziałów',
                'Terminy rejestracji',
                'Najbliższe wydarzenia',
              ][i]
            }
          </button>
        ))}
        <span>Bez logowania</span>
      </div>
    </BaseCard>
  )
}
