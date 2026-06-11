-- Re-cohorting: zmiana pól studiów w profilu zdejmuje członkostwo w STARYM
-- roczniku przed wpisaniem do nowego.
--
-- Migracja 20260611200000_cohorts_and_aula.sql dodawała tylko `ensure_cohort_for_profile`
-- po UPDATE — efekt uboczny: user zmieniający kierunek/rok/tryb zostawał członkiem
-- starego cohortu (RLS pozwalał pisać w dwóch czatach jednocześnie). Tutaj nowy
-- body funkcji wycina stare członkostwo zanim doda nowe.
--
-- Idempotentna (CREATE OR REPLACE FUNCTION) i nie zmienia podpięcia triggera
-- `on_profile_cohort_fields_change` — istniejący trigger zaczyna używać nowej
-- wersji funkcji automatycznie.
--
-- Historyczne wiadomości użytkownika w starym roczniku zostają (poprawne
-- historycznie); user traci do nich dostęp przez RLS, co jest pożądane —
-- nie powinien już komentować w roczniku, do którego nie należy.

CREATE OR REPLACE FUNCTION public.handle_profile_cohort_fields_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_cohort_id UUID;
  v_changed BOOLEAN := FALSE;
BEGIN
  -- UPDATE: jeśli OLD miał kompletne pola studiów i RÓŻNE od NEW, wypisz ze
  -- starego cohortu. INSERT: brak OLD, tylko ensure_cohort_for_profile.
  IF TG_OP = 'UPDATE' THEN
    v_changed :=
      COALESCE(OLD.study_program, '') IS DISTINCT FROM COALESCE(NEW.study_program, '')
      OR OLD.year_started IS DISTINCT FROM NEW.year_started
      OR COALESCE(OLD.study_mode, '') IS DISTINCT FROM COALESCE(NEW.study_mode, '');

    IF v_changed
       AND OLD.study_program IS NOT NULL AND btrim(OLD.study_program) <> ''
       AND OLD.year_started IS NOT NULL
       AND OLD.study_mode IS NOT NULL
    THEN
      SELECT id INTO v_old_cohort_id
      FROM public.cohorts
      WHERE study_program = btrim(OLD.study_program)
        AND year_started = OLD.year_started
        AND study_mode = OLD.study_mode;

      IF v_old_cohort_id IS NOT NULL THEN
        DELETE FROM public.cohort_members
        WHERE cohort_id = v_old_cohort_id
          AND user_id = NEW.id;
      END IF;
    END IF;
  END IF;

  PERFORM public.ensure_cohort_for_profile(NEW.id);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_profile_cohort_fields_change() IS
  'Trigger body: usuwa stare cohort_members (gdy pola studiów się zmieniły i były kompletne) i wpina do nowego cohortu przez ensure_cohort_for_profile.';
