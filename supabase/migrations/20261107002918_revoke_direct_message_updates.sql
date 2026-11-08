-- Harden message update permissions.
-- Read receipts must be updated through mark_messages_read RPC.

-- Remove the old broad receiver update policy.
DROP POLICY IF EXISTS
  "Receivers can mark messages read"
ON public.messages;

-- Revoke table-level UPDATE permissions.
REVOKE UPDATE ON TABLE public.messages
FROM PUBLIC, anon, authenticated;

-- Remove separately granted column-level UPDATE permissions.
DO $$
DECLARE
  col RECORD;
BEGIN
  FOR col IN
    SELECT attname
    FROM pg_attribute
    WHERE attrelid = 'public.messages'::regclass
      AND attnum > 0
      AND NOT attisdropped
  LOOP
    EXECUTE format(
      'REVOKE UPDATE (%I) ON TABLE public.messages
       FROM PUBLIC, anon, authenticated',
      col.attname
    );
  END LOOP;
END;
$$;
