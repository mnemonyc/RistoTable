-- RistoTable - Layout reale Sala Interna + numerazione reale Sala Esterna
-- Restaurant: BACCO IL TEMPIO DEL PANZEROTTO
-- restaurant_id: 0153d55d-1f5c-42c9-8da2-4eab40533c4e

BEGIN;

-- ============================================================
-- SALA INTERNA
-- Posizioni ricavate dalla piantina fornita.
-- ============================================================

UPDATE public.dining_tables AS t
SET
  pos_x = v.pos_x,
  pos_y = v.pos_y
FROM (
  VALUES
    ('T1',  70, 210),
    ('T2',  70, 135),
    ('T3',  70,  60),
    ('T4', 240,  85),
    ('T5', 260, 165),
    ('T6', 242, 240),
    ('T7', 242, 300),
    ('T8', 285, 365),
    ('T9', 425, 365),
    ('T10', 325, 265),
    ('T11', 425, 265),
    ('T12', 695, 165),
    ('T13', 695,  60),
    ('T14', 835,  60),
    ('T15', 835, 165),
    ('T16', 835, 270)
) AS v(table_name, pos_x, pos_y)
WHERE t.table_name = v.table_name
  AND t.room_id = (
    SELECT r.id
    FROM public.rooms AS r
    WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
      AND lower(r.room_name) = 'interno'
    LIMIT 1
  );

-- ============================================================
-- SALA ESTERNA
-- Numerazione reale comunicata dall'utente.
--
-- T17 -> T30
-- T18 -> T31
-- T19 -> T32
-- T20 -> T33
-- T21 -> T34
-- T22 -> T20
-- T23 -> T21
-- T24 -> T22
-- T25 -> T23
-- T26 -> T24
--
-- Prima aggiorniamo temporaneamente i nomi per evitare
-- collisioni con T20-T24 già esistenti.
-- ============================================================

UPDATE public.dining_tables AS t
SET table_name = CASE t.table_name
  WHEN 'T17' THEN '__EXT_T17'
  WHEN 'T18' THEN '__EXT_T18'
  WHEN 'T19' THEN '__EXT_T19'
  WHEN 'T20' THEN '__EXT_T20'
  WHEN 'T21' THEN '__EXT_T21'
  WHEN 'T22' THEN '__EXT_T22'
  WHEN 'T23' THEN '__EXT_T23'
  WHEN 'T24' THEN '__EXT_T24'
  WHEN 'T25' THEN '__EXT_T25'
  WHEN 'T26' THEN '__EXT_T26'
  ELSE t.table_name
END
WHERE t.room_id = (
  SELECT r.id
  FROM public.rooms AS r
  WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
    AND lower(r.room_name) = 'esterno'
  LIMIT 1
);

UPDATE public.dining_tables AS t
SET table_name = CASE t.table_name
  WHEN '__EXT_T17' THEN 'T30'
  WHEN '__EXT_T18' THEN 'T31'
  WHEN '__EXT_T19' THEN 'T32'
  WHEN '__EXT_T20' THEN 'T33'
  WHEN '__EXT_T21' THEN 'T34'
  WHEN '__EXT_T22' THEN 'T20'
  WHEN '__EXT_T23' THEN 'T21'
  WHEN '__EXT_T24' THEN 'T22'
  WHEN '__EXT_T25' THEN 'T23'
  WHEN '__EXT_T26' THEN 'T24'
  ELSE t.table_name
END
WHERE t.room_id = (
  SELECT r.id
  FROM public.rooms AS r
  WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
    AND lower(r.room_name) = 'esterno'
  LIMIT 1
);

COMMIT;

-- ============================================================
-- VERIFICA
-- ============================================================

SELECT
  r.room_name,
  t.table_name,
  t.seats,
  t.pos_x,
  t.pos_y,
  t.active
FROM public.dining_tables AS t
JOIN public.rooms AS r
  ON r.id = t.room_id
WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
ORDER BY
  CASE lower(r.room_name)
    WHEN 'interno' THEN 1
    WHEN 'esterno' THEN 2
    ELSE 3
  END,
  CASE
    WHEN t.table_name ~ '^T?\\d+$'
      THEN regexp_replace(t.table_name, '^T', '')::integer
    ELSE 9999
  END,
  t.table_name;
