import { useId } from 'react'
import { ArrowUpRight, ChevronDown, GraduationCap } from 'lucide-react'
import { useStudyProfile } from '../../hooks/useStudyProfile'
import {
  PILOT_PROGRAMMES,
  STUDY_DEGREE_LABELS,
  getPilotProgramme,
  setStudyProfile,
  withStudyDegree,
  withStudyProgramme,
  withStudyYear,
  type PilotProgrammeId,
  type StudyDegree,
} from '../../lib/info/studyProfile'
import '../../styles/study-profile.css'

type Props = {
  faculty: string | null
  /** Reuse the main faculty preference when a programme from another faculty is chosen. */
  onFacultyChange: (faculty: string | null) => void
}

export default function StudyProfilePicker({
  faculty,
  onFacultyChange,
}: Props) {
  const id = useId()
  const { profile, programme, persistent, label, storedProfile } =
    useStudyProfile(faculty)
  const years =
    programme && profile.degree ? programme.yearsByDegree[profile.degree] : 0
  const hasInactiveProfile = Boolean(storedProfile.programmeId && !programme)

  return (
    <details className="study-profile">
      <summary>
        <GraduationCap size={18} strokeWidth={1.75} aria-hidden />
        <span>{label ?? 'Dopasuj do swoich studiów'}</span>
        <ChevronDown size={15} aria-hidden />
      </summary>
      <div className="study-profile-body">
        <p id={`${id}-help`}>
          Pilotaż dla EPI na WZiKS i filozofii. Wybierz kierunek, stopień i rok
          na tym urządzeniu. Terminy bez potwierdzonego przypisania do kierunku
          nadal pokazujemy dla całego wydziału.
        </p>
        <div className="study-profile-fields" aria-describedby={`${id}-help`}>
          <label htmlFor={`${id}-programme`}>
            Kierunek
            <select
              id={`${id}-programme`}
              value={programme?.id ?? ''}
              onChange={(event) => {
                const next = event.target.value as PilotProgrammeId | ''
                const chosen = getPilotProgramme(next)
                setStudyProfile(withStudyProgramme(chosen?.id ?? null))
                if (chosen) onFacultyChange(chosen.faculty)
              }}
            >
              <option value="">Wszystkie kierunki / nie wybieram</option>
              {PILOT_PROGRAMMES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.facultyShort}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-degree`}>
            Stopień studiów
            <select
              id={`${id}-degree`}
              value={profile.degree ?? ''}
              disabled={!programme}
              onChange={(event) =>
                setStudyProfile(
                  withStudyDegree(
                    profile,
                    (event.target.value || null) as StudyDegree | null,
                  ),
                )
              }
            >
              <option value="">Wszystkie stopnie / nie wybieram</option>
              {Object.entries(STUDY_DEGREE_LABELS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-year`}>
            Rok studiów
            <select
              id={`${id}-year`}
              value={profile.year ?? ''}
              disabled={!years}
              onChange={(event) =>
                setStudyProfile(
                  withStudyYear(
                    profile,
                    event.target.value ? Number(event.target.value) : null,
                  ),
                )
              }
            >
              <option value="">Wszystkie lata / nie wybieram</option>
              {Array.from({ length: years }, (_, index) => index + 1).map(
                (year) => (
                  <option key={year} value={year}>
                    {year}. rok
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div className="study-profile-context">
          {programme ? (
            <>
              <p>
                {programme.faculty} · studia {programme.mode}
              </p>
              <a
                href={programme.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Oficjalny opis kierunku <ArrowUpRight size={14} aria-hidden />
              </a>
              <span>Strukturę studiów sprawdzono 11.11.2026.</span>
            </>
          ) : hasInactiveProfile ? (
            <p>
              Po zmianie wydziału wcześniejszy kierunek jest nieaktywny. Możesz
              wybrać go ponownie.
            </p>
          ) : (
            <p>
              Nie ma tu Twojego kierunku? Informacje dla wybranego wydziału
              pozostają dostępne.
            </p>
          )}
          <p>
            {persistent
              ? 'Wybór zapisuje się tylko na tym urządzeniu.'
              : 'Wybór działa w tej karcie. Przeglądarka nie pozwala go zapisać.'}
          </p>
        </div>
      </div>
    </details>
  )
}
