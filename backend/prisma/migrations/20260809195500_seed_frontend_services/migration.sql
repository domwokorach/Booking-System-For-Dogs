INSERT INTO "Service" ("id", "name", "description", "durationMinutes", "active", "createdAt", "updatedAt")
VALUES
  ('training', 'Training', 'Private one-on-one obedience, recall, and leash manners sessions.', 60, true, NOW(), NOW()),
  ('daycare', 'Daycare', 'Supervised daycare with play, enrichment, and rest periods.', 720, true, NOW(), NOW()),
  ('boarding', 'Boarding', 'Overnight boarding with walks, bedding, and around-the-clock care.', 1440, true, NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
