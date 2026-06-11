import { useCallback, useEffect, useMemo, useState } from 'react'
import { CohortService } from '../services/CohortService'
import type { Cohort } from '../types/database'
import type { Profile } from '../types'

type Params = {
  userId: string | null
  myProfile: Profile | null
}

/**
 * Rozstrzyga rocznik (cohort) zalogowanego użytkownika dla widoku Aula.
 *
 * `hasMissingProfileFields` = brak któregoś z pól studiów w profilu →
 * AulaView pokazuje onboarding modal zamiast czatu.
 */
export function useMyCohort({ userId, myProfile }: Params) {
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [loading, setLoading] = useState(true)

  const hasMissingProfileFields = useMemo(() => {
    if (!myProfile) return true
    return (
      !myProfile.study_program ||
      myProfile.year_started == null ||
      !myProfile.study_mode
    )
  }, [myProfile])

  const refetch = useCallback(async () => {
    if (!userId) {
      setCohort(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await CohortService.getMyCohorts(userId)
    if (error) {
      console.error('[useMyCohort]', error.message)
      setCohort(null)
    } else {
      setCohort(data[0] ?? null)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return useMemo(
    () => ({ cohort, loading, hasMissingProfileFields, refetch }),
    [cohort, loading, hasMissingProfileFields, refetch],
  )
}
