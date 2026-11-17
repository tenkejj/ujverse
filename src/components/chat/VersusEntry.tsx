import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import VersuMark from './VersuMark'
import VersusAbout from './VersusAbout'
import VersusQuestions from './VersusQuestions'
import { versusEntryState } from '../../lib/versusEntry'
import '../../styles/versus-scene.css'

/** The first message joins the existing conversation via its one-shot handoff. */
export default function VersusEntry() {
  const composer = useRef<HTMLTextAreaElement>(null)

  const [question, setQuestion] = useState('')
  const [isFocused, setFocused] = useState(false)
  const [isGreeting, setGreeting] = useState(false)
  useLayoutEffect(() => {
    const input = composer.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(160, input.scrollHeight)}px`
  }, [question])
  const navigate = useNavigate()
  const ask = (prompt: string) =>
    navigate('/chat', { state: versusEntryState(prompt.trim()) })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (question.trim()) ask(question)
  }
  return (
    <section
      className="versus-scene"
      aria-labelledby="versus-scene-heading"
    >
      <div className="versus-scene-main">
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
            priority
            activity={
              isFocused ? 'listening' : isGreeting ? 'greeting' : 'idle'
            }
          />
        </button>
        <div className="versus-scene-workspace">
          <header className="versus-scene-greeting">
            <h1 id="versus-scene-heading">Cześć, tu Versuś.</h1>
            <p>Twój asystent AI do spraw na UJ. Pytaj po swojemu.</p>
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
                onChange={(e) => setQuestion(e.target.value)}
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
            <VersusQuestions onSelect={(prompt) => {
              setQuestion(prompt)
              composer.current?.focus()
            }} />
          </form>
          <VersusAbout />
        </div>
      </div>
    </section>
  )
}
