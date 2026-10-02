-- types.meta_group_id: the type's meta group (1 Tech I, 2 Tech II, 4 Faction,
-- 14 Tech III, ...) from CCP's Static Data Export. ESI's type endpoint does not
-- carry it and dogma attribute 1692 is missing on many types, so it is filled
-- by `yarn sde:meta-groups`. Nullable, no default: null until that runs.

-- AlterTable
ALTER TABLE "types" ADD COLUMN "meta_group_id" INTEGER;
