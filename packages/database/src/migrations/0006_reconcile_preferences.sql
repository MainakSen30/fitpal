-- users is the canonical preference source. Only non-default profile values
-- represent an explicit choice by the only code path that used them, so
-- default profile rows never overwrite a user's existing choice.
UPDATE "users" AS u
SET "timezone" = p."timezone"
FROM "profiles" AS p
WHERE p."user_id" = u."id" AND p."timezone" <> 'UTC';

UPDATE "users" AS u
SET "unit_system" = 'imperial'
FROM "profiles" AS p
WHERE p."user_id" = u."id" AND p."weight_unit" = 'lb';
