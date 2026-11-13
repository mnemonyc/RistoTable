-- Durata di occupazione del tavolo salvata per singola prenotazione.
-- Le prenotazioni già esistenti mantengono 105 minuti.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS occupancy_duration_minutes integer NOT NULL DEFAULT 105;

UPDATE public.reservations
SET occupancy_duration_minutes = 105
WHERE occupancy_duration_minutes IS NULL;

ALTER TABLE public.reservations
  ALTER COLUMN occupancy_duration_minutes SET DEFAULT 105,
  ALTER COLUMN occupancy_duration_minutes SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reservations_occupancy_duration_minutes_check'
      AND conrelid = 'public.reservations'::regclass
  ) THEN
    ALTER TABLE public.reservations
      ADD CONSTRAINT reservations_occupancy_duration_minutes_check
      CHECK (occupancy_duration_minutes IN (90, 105));
  END IF;
END $$;
