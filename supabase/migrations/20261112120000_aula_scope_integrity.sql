-- Keep Aula relationships inside their original cohort at the database boundary.
-- No existing rows are rewritten and no privileges are granted. Restrictive
-- policies supplement the original member/owner policies, so another permissive
-- policy cannot restore the owner-only mutation gap.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_cohort_message_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cohort_id IS DISTINCT FROM OLD.cohort_id THEN
    RAISE EXCEPTION 'Aula message cohort is immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cohort_messages parent
    WHERE parent.id = NEW.parent_id AND parent.cohort_id = NEW.cohort_id
  ) THEN
    RAISE EXCEPTION 'Aula parent must belong to the message cohort' USING ERRCODE = '23514';
  END IF;

  IF NEW.channel_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cohort_channels channel
    WHERE channel.id = NEW.channel_id AND channel.cohort_id = NEW.cohort_id
  ) THEN
    RAISE EXCEPTION 'Aula channel must belong to the message cohort' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_message_scope_integrity ON public.cohort_messages;
CREATE TRIGGER on_cohort_message_scope_integrity
  BEFORE INSERT OR UPDATE OF cohort_id, parent_id, channel_id
  ON public.cohort_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_cohort_message_scope();

CREATE OR REPLACE FUNCTION public.validate_cohort_channel_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.cohort_id IS DISTINCT FROM OLD.cohort_id THEN
    RAISE EXCEPTION 'Aula channel cohort is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_cohort_channel_scope_integrity ON public.cohort_channels;
CREATE TRIGGER on_cohort_channel_scope_integrity
  BEFORE UPDATE OF cohort_id ON public.cohort_channels
  FOR EACH ROW EXECUTE FUNCTION public.validate_cohort_channel_scope();

CREATE OR REPLACE FUNCTION public.validate_cohort_attachment_scope()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_cohort uuid;
BEGIN
  SELECT cohort_id INTO v_parent_cohort
  FROM public.cohort_messages WHERE id = NEW.message_id;
  IF v_parent_cohort IS NULL
     OR (NEW.cohort_id IS NOT NULL AND NEW.cohort_id <> v_parent_cohort) THEN
    RAISE EXCEPTION 'Aula attachment must belong to its parent cohort' USING ERRCODE = '23514';
  END IF;
  NEW.cohort_id := v_parent_cohort;
  RETURN NEW;
END;
$$;

-- Retain the existing fill trigger; validate supplied (including non-null)
-- cohort IDs and later changes as well. These functions run as the caller,
-- so their parent/channel lookups obey the same RLS as the originating write.
DROP TRIGGER IF EXISTS on_cohort_attachment_scope_integrity ON public.cohort_message_attachments;
CREATE TRIGGER on_cohort_attachment_scope_integrity
  BEFORE INSERT OR UPDATE OF message_id, cohort_id
  ON public.cohort_message_attachments
  FOR EACH ROW EXECUTE FUNCTION public.validate_cohort_attachment_scope();

DROP POLICY IF EXISTS cohort_messages_update_scope_guard ON public.cohort_messages;
CREATE POLICY cohort_messages_update_scope_guard
  ON public.cohort_messages AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_members member
      WHERE member.cohort_id = cohort_messages.cohort_id
        AND member.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_members member
      WHERE member.cohort_id = cohort_messages.cohort_id
        AND member.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_messages_delete_scope_guard ON public.cohort_messages;
CREATE POLICY cohort_messages_delete_scope_guard
  ON public.cohort_messages AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_members member
      WHERE member.cohort_id = cohort_messages.cohort_id
        AND member.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_channels_update_scope_guard ON public.cohort_channels;
CREATE POLICY cohort_channels_update_scope_guard
  ON public.cohort_channels AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_members member
      WHERE member.cohort_id = cohort_channels.cohort_id
        AND member.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    created_by = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_members member
      WHERE member.cohort_id = cohort_channels.cohort_id
        AND member.user_id = (SELECT auth.uid())
    )
  );

-- Denormalized legacy attachment rows must not expose metadata if their
-- declared cohort disagrees with their parent. Hide those rows, do not delete
-- or repair them automatically. The parent SELECT also enforces membership.
DROP POLICY IF EXISTS cohort_attachments_select_scope_guard ON public.cohort_message_attachments;
CREATE POLICY cohort_attachments_select_scope_guard
  ON public.cohort_message_attachments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.cohort_messages parent
    WHERE parent.id = cohort_message_attachments.message_id
      AND parent.cohort_id = cohort_message_attachments.cohort_id
  ));

DROP POLICY IF EXISTS cohort_attachments_insert_scope_guard ON public.cohort_message_attachments;
CREATE POLICY cohort_attachments_insert_scope_guard
  ON public.cohort_message_attachments AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_messages parent
      WHERE parent.id = cohort_message_attachments.message_id
        AND parent.cohort_id = cohort_message_attachments.cohort_id
        AND parent.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS cohort_attachments_delete_scope_guard ON public.cohort_message_attachments;
CREATE POLICY cohort_attachments_delete_scope_guard
  ON public.cohort_message_attachments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid()) AND EXISTS (
      SELECT 1 FROM public.cohort_messages parent
      WHERE parent.id = cohort_message_attachments.message_id
        AND parent.cohort_id = cohort_message_attachments.cohort_id
    )
  );

COMMIT;
