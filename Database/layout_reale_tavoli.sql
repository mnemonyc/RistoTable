-- RistoTable - Layout DEFINITIVO Sala Interna
-- Usa direttamente l'ID della sala Interno per evitare qualsiasi
-- problema di corrispondenza con room_name.

BEGIN;

UPDATE public.dining_tables
SET
  pos_x = CASE table_name
    WHEN 'T1'  THEN 30
    WHEN 'T2'  THEN 30
    WHEN 'T3'  THEN 30
    WHEN 'T4'  THEN 200
    WHEN 'T5'  THEN 200
    WHEN 'T6'  THEN 200
    WHEN 'T7'  THEN 200
    WHEN 'T8'  THEN 330
    WHEN 'T9'  THEN 500
    WHEN 'T10' THEN 330
    WHEN 'T11' THEN 500
    WHEN 'T12' THEN 650
    WHEN 'T13' THEN 650
    WHEN 'T14' THEN 800
    WHEN 'T15' THEN 800
    WHEN 'T16' THEN 800
  END,
  pos_y = CASE table_name
    WHEN 'T1'  THEN 250
    WHEN 'T2'  THEN 160
    WHEN 'T3'  THEN 70
    WHEN 'T4'  THEN 70
    WHEN 'T5'  THEN 160
    WHEN 'T6'  THEN 250
    WHEN 'T7'  THEN 340
    WHEN 'T8'  THEN 430
    WHEN 'T9'  THEN 430
    WHEN 'T10' THEN 340
    WHEN 'T11' THEN 340
    WHEN 'T12' THEN 180
    WHEN 'T13' THEN 70
    WHEN 'T14' THEN 70
    WHEN 'T15' THEN 180
    WHEN 'T16' THEN 290
  END
WHERE room_id = '07f82333-b03e-46df-81ed-8946de2e39d1'
  AND table_name IN (
    'T1','T2','T3','T4','T5','T6','T7','T8',
    'T9','T10','T11','T12','T13','T14','T15','T16'
  );

-- Questo SELECT deve restituire 16 righe.
SELECT
  table_name,
  pos_x,
  pos_y
FROM public.dining_tables
WHERE room_id = '07f82333-b03e-46df-81ed-8946de2e39d1'
ORDER BY
  CASE
    WHEN table_name ~ '^T[0-9]+$'
      THEN regexp_replace(table_name, '^T', '')::integer
    ELSE 9999
  END;

COMMIT;