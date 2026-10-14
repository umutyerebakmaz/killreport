-- CCP's schematic 2D map position, from the SDE (yarn sde:map-2d). ESI has no
-- such field. Nullable: wormhole, Abyssal and Proving systems have none.
ALTER TABLE "solar_systems" ADD COLUMN "position_2d_x" DOUBLE PRECISION,
ADD COLUMN "position_2d_y" DOUBLE PRECISION;
