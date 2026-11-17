import { useId, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { VERSUS_QUESTION_SUGGESTIONS } from '../../lib/chatQuickPrompts'

/** Progressive disclosure stays next to the composer without stretching the hero. */
export default function VersusQuestions({ onSelect }: { onSelect: (question: string) => void }) {
  const panelId = useId()
  const details = useRef<HTMLDetailsElement>(null)
  const select = (question: string) => {
    if (details.current) details.current.open = false
    onSelect(question)
  }
  return (
    <div className="versus-questions" role="group" aria-label="Gotowe pytania do Versusia">
      {VERSUS_QUESTION_SUGGESTIONS.slice(0, 3).map(({ label, question }) => (
        <button type="button" key={question} aria-label={question} onClick={() => select(question)}>{label}</button>
      ))}
      <details ref={details} className="versus-questions-more" onKeyDown={(event) => {
        if (event.key === 'Escape' && details.current?.open) {
          event.preventDefault()
          details.current.open = false
          details.current.querySelector('summary')?.focus()
        }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false
      }}>
        <summary aria-controls={panelId}>Więcej pytań <ChevronDown size={14} aria-hidden /></summary>
        <div id={panelId} className="versus-questions-panel">
          <p>Zapytaj o publiczne informacje UJ</p>
          {VERSUS_QUESTION_SUGGESTIONS.slice(3).map(({ question }) => (
            <button type="button" key={question} onClick={() => select(question)}>{question}</button>
          ))}
        </div>
      </details>
    </div>
  )
}
