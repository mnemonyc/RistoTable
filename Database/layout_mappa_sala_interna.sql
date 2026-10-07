-- RistoTable - Layout reale Sala Interna
-- Mappa basata sulla piantina fornita.
-- Coordinate pensate per la TableMap con area di riferimento circa 900 x 500 px.
-- Le coordinate sono volutamente raccolte qui, così possono essere corrette
-- senza modificare la logica delle prenotazioni.

UPDATE public.dining_tables AS t
SET
  pos_x = v.pos_x,
  pos_y = v.pos_y
FROM (
  VALUES
    ('1',  70, 210),
    ('2',  70, 135),
    ('3',  70,  60),
    ('4', 240,  85),
    ('5', 260, 165),
    ('6', 242, 240),
    ('7', 242, 300),
    ('8', 285, 365),
    ('9', 425, 365),
    ('10', 325, 265),
    ('11', 425, 265),
    ('12', 695, 165),
    ('13', 695,  60),
    ('14', 835,  60),
    ('15', 835, 165),
    ('16', 835, 270)
) AS v(table_name, pos_x, pos_y)
WHERE t.table_name = v.table_name
  AND t.room_id = (
    SELECT r.id
    FROM public.rooms AS r
    WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
      AND lower(r.room_name) = 'interno'
    LIMIT 1
  );

-- Verifica finale:
SELECT
  t.table_name,
  t.seats,
  t.pos_x,
  t.pos_y
FROM public.dining_tables AS t
JOIN public.rooms AS r
  ON r.id = t.room_id
WHERE r.restaurant_id = '0153d55d-1f5c-42c9-8da2-4eab40533c4e'
  AND lower(r.room_name) = 'interno'
ORDER BY
  CASE
    WHEN t.table_name ~ '^\\d+$'
      THEN t.table_name::integer
    ELSE 9999
  END,
  t.table_name;
