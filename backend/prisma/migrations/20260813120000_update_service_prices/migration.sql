UPDATE "Service"
SET "pricePence" = CASE
  WHEN "id" = 'grooming' OR "name" = 'Grooming' THEN 3000
  WHEN "id" = 'training' OR "name" = 'Training' THEN 1500
  WHEN "id" = 'daycare' OR "name" = 'Daycare' THEN 4500
  WHEN "id" = 'boarding' OR "name" = 'Boarding' THEN 5000
  ELSE "pricePence"
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('grooming', 'training', 'daycare', 'boarding')
   OR "name" IN ('Grooming', 'Training', 'Daycare', 'Boarding');
