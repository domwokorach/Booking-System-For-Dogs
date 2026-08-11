CREATE SEQUENCE "User_customerReference_seq"
AS BIGINT
START WITH 1
INCREMENT BY 1
MINVALUE 1
CACHE 1
OWNED BY "User"."customerReference";

WITH numbered_users AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS reference_number
  FROM "User"
)
UPDATE "User" AS customer
SET "customerReference" =
  'CUS-' || LPAD(numbered_users.reference_number::TEXT, 6, '0')
FROM numbered_users
WHERE customer."id" = numbered_users."id";

SELECT setval(
  '"User_customerReference_seq"',
  GREATEST((SELECT COUNT(*) FROM "User"), 1),
  EXISTS(SELECT 1 FROM "User")
);
