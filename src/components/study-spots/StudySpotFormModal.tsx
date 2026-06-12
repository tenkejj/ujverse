/**
 * UJverse — StudySpotFormModal: dodawanie nowego miejsca przez community.
 *
 * Copyright © 2026 Franciszek Dranka. All rights reserved.
 * License: Proprietary — see LICENSE in repo root.
 */
import { useCallback, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { theme } from '../../styles/theme'
import {
  STUDY_SPOT_KINDS,
  STUDY_SPOT_KIND_META,
  type StudySpotCreateInput,
  type StudySpotKind,
} from '../../types/studySpots'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (input: StudySpotCreateInput) => Promise<{ ok: boolean; error: string | null }>
}

const FIELD_CLS =
  'h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-700 placeholder:text-zinc-400 focus:border-[#1e293b]/40 focus:outline-none dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200'

const LABEL_CLS = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400'

export default function StudySpotFormModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [kind, setKind] = useState<StudySpotKind>('cafe')
  const [description, setDescription] = useState('')
  const [hoursText, setHoursText] = useState('')
  const [tags, setTags] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [isFree, setIsFree] = useState(true)
  const [priceHint, setPriceHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setName('')
    setAddress('')
    setLat('')
    setLng('')
    setKind('cafe')
    setDescription('')
    setHoursText('')
    setTags('')
    setGoogleMapsUrl('')
    setIsFree(true)
    setPriceHint('')
    setError(null)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setError(null)

      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)

      if (name.trim().length < 2) {
        setError('Nazwa za krótka')
        return
      }
      if (address.trim().length < 4) {
        setError('Adres za krótki')
        return
      }
      if (Number.isNaN(latNum) || latNum < 49 || latNum > 51) {
        setError('Lat musi być w okolicy Krakowa (49-51)')
        return
      }
      if (Number.isNaN(lngNum) || lngNum < 19 || lngNum > 21) {
        setError('Lng musi być w okolicy Krakowa (19-21)')
        return
      }

      setBusy(true)
      const tagsList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      const result = await onCreate({
        name: name.trim(),
        address: address.trim(),
        lat: latNum,
        lng: lngNum,
        kind,
        description: description.trim() || null,
        hours_text: hoursText.trim() || null,
        tags: tagsList,
        google_maps_url: googleMapsUrl.trim() || null,
        is_free: isFree,
        price_hint: isFree ? null : priceHint.trim() || null,
      })
      setBusy(false)

      if (result.ok) {
        reset()
        onClose()
      } else {
        setError(result.error ?? 'Nie udało się zapisać')
      }
    },
    [name, address, lat, lng, kind, description, hoursText, tags, googleMapsUrl, isFree, priceHint, onCreate, onClose, reset],
  )

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-100 flex items-end justify-center bg-black/40 backdrop-blur-sm md:items-center"
          onClick={onClose}
        >
          <motion.form
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 22, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-3xl dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-zinc-200/70 px-5 py-4 dark:border-white/10">
              <h2 className={`text-lg font-bold ${theme.text.primary}`}>Dodaj miejsce do nauki</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/[0.06] dark:hover:text-zinc-200"
                aria-label="Zamknij"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-3.5">
                <div>
                  <label className={LABEL_CLS}>Nazwa *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Np. Mleko Cafe (Krupnicza)"
                    className={FIELD_CLS}
                    maxLength={120}
                    required
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Adres *</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="ul. Krupnicza 7, Kraków"
                    className={FIELD_CLS}
                    maxLength={240}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Lat *</label>
                    <input
                      type="text"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                      placeholder="50.06234"
                      className={FIELD_CLS}
                      required
                    />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Lng *</label>
                    <input
                      type="text"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                      placeholder="19.93421"
                      className={FIELD_CLS}
                      required
                    />
                  </div>
                </div>
                <p className={`text-[10.5px] ${theme.text.muted}`}>
                  Tip: w Google Maps prawym przyciskiem na pinezce → "Co tu jest?" pokazuje współrzędne.
                </p>

                <div>
                  <label className={LABEL_CLS}>Typ *</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as StudySpotKind)}
                    className={FIELD_CLS}
                  >
                    {STUDY_SPOT_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {STUDY_SPOT_KIND_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLS}>Opis</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Co tutaj jest super: cisza, gniazdka, kawa, wifi, klimat..."
                    maxLength={1500}
                    rows={3}
                    className={FIELD_CLS.replace('h-10', 'h-auto py-2')}
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Godziny otwarcia</label>
                  <input
                    type="text"
                    value={hoursText}
                    onChange={(e) => setHoursText(e.target.value)}
                    placeholder="pn-pt 8:00-22:00, sob 10:00-18:00"
                    className={FIELD_CLS}
                    maxLength={240}
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Tagi (oddziel przecinkiem)</label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="kawa, gniazdka, cisza, klimat"
                    className={FIELD_CLS}
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Link Google Maps</label>
                  <input
                    type="url"
                    value={googleMapsUrl}
                    onChange={(e) => setGoogleMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className={FIELD_CLS}
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={isFree}
                    onChange={(e) => setIsFree(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-emerald-500 focus:ring-emerald-400"
                  />
                  <span className={theme.text.primary}>Darmowe / kawa nie jest wymagana</span>
                </label>

                {!isFree && (
                  <div>
                    <label className={LABEL_CLS}>Cena przybliżona</label>
                    <input
                      type="text"
                      value={priceHint}
                      onChange={(e) => setPriceHint(e.target.value)}
                      placeholder="np. kawa od 14zł, pakiet dzienny 40zł"
                      className={FIELD_CLS}
                      maxLength={80}
                    />
                  </div>
                )}

                {error && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-zinc-200/70 px-5 py-3 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-full px-4 py-2 text-[12.5px] font-semibold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-white/[0.06]"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-emerald-500 px-5 py-2 text-[12.5px] font-bold uppercase tracking-wide text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? 'Zapisuję...' : 'Dodaj miejsce'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
