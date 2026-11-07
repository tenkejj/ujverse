import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send } from 'lucide-react'
import VersuMark from './VersuMark'
import { PUBLIC_CHAT_QUICK_PROMPTS } from '../../lib/chatQuickPrompts'
import { versusEntryState } from '../../lib/versusEntry'
import BaseCard from '../ui/BaseCard'

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
      <header className="versus-entry-header">
        <div
          className="versus-entry-mascot"
          aria-hidden="true"
          onPointerEnter={() => setGreeting(true)}
          onPointerLeave={() => setGreeting(false)}
        >
          <VersuMark
            size={96}
            activity={
              isFocused ? 'listening' : isGreeting ? 'greeting' : 'idle'
            }
          />
        </div>
        <div className="versus-entry-copy">
          <div className="versus-entry-title-row">
            <h2 id="versus-entry-heading">Zapytaj Versusia</h2>
            <span className="versus-entry-access">AI · Bez logowania</span>
          </div>
          <p className="versus-entry-description">
            Znajdź komunikaty, terminy rejestracji i wydarzenia. Zapytaj po
            swojemu.
          </p>
        </div>
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
            {PUBLIC_CHAT_QUICK_PROMPTS.slice(0, 3).map((prompt, i) => (
              <button type="button" key={prompt} onClick={() => ask(prompt)}>
                {['Co nowego?', 'Kiedy rejestracje?', 'Jakie wydarzenia?'][i]}
              </button>
            ))}
          </div>
        </div>
      </form>
    </BaseCard>
  )
}
