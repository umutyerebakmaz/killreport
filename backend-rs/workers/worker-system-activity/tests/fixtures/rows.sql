-- One region, one constellation and 6000 solar systems, 30000001..=30006000:
-- enough for every system ID the tests write, the full-size snapshot included.
INSERT INTO regions (region_id, name) VALUES (10000001, 'Derelik');
INSERT INTO constellations (constellation_id, name, region_id)
VALUES (20000001, 'San Matar', 10000001);
INSERT INTO solar_systems (system_id, name, constellation_id)
SELECT id, 'System ' || id, 20000001 FROM generate_series(30000001, 30006000) AS id;
