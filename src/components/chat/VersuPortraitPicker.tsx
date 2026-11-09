import { useId, useSyncExternalStore } from 'react'
import {
  getUserPreferences,
  setUserPreference,
  subscribePreferences,
  type VersuPortraitChoice,
} from '../../lib/userPreferences'
import '../../styles/versu-portrait-picker.css'

const PORTRAITS: readonly {
  value: VersuPortraitChoice
  label: string
  pose: string
}[] = [
  { value: 'classic', label: 'Spokojny', pose: 'face-idle' },
  { value: 'curious', label: 'Ciekawski', pose: 'face-listening' },
  { value: 'scholar', label: 'Zaczytany', pose: 'face-thinking' },
]
const readPortrait = () => getUserPreferences().versusPortrait
const serverPortrait = (): VersuPortraitChoice => 'classic'

/** Native radios keep the three local portrait choices keyboard-accessible. */
export default function VersuPortraitPicker({
  assetBase = '/versus',
}: {
  /** Root may supply a theme-specific directory; names stay shared across palettes. */
  assetBase?: string
}) {
  const groupId = useId()
  const selected = useSyncExternalStore(
    subscribePreferences,
    readPortrait,
    serverPortrait,
  )
  return (
    <fieldset className="versu-portrait-picker">
      <legend>Portret Versusia</legend>
      <div className="versu-portrait-options">
        {PORTRAITS.map(({ value, label, pose }) => (
          <label className="versu-portrait-option" key={value}>
            <input
              type="radio"
              name={`versu-portrait-${groupId}`}
              value={value}
              checked={selected === value}
              onChange={() => setUserPreference('versusPortrait', value)}
            />
            <span className="versu-portrait-choice">
              <span className="versu-portrait-preview" aria-hidden="true">
                <img
                  src={`${assetBase}/${pose}.png?v=portrait1`}
                  alt=""
                  width={48}
                  height={48}
                  draggable={false}
                />
              </span>
              <span>{label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
