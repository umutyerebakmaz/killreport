-- One region, one constellation, a system in it, a system with no
-- constellation, and one alliance: every join `build_alert` makes, and the
-- two ways it can come up short.
INSERT INTO regions (region_id, name) VALUES (10000001, 'Delve');
INSERT INTO constellations (constellation_id, name, region_id)
VALUES (20000001, 'O-EIMK', 10000001);
INSERT INTO solar_systems (system_id, name, constellation_id)
VALUES (30000001, '1DQ1-A', 20000001), (30000002, 'Orphan', NULL);
INSERT INTO alliances (id, name, ticker, date_founded, creator_corporation_id, creator_id, updated_at)
VALUES (99000001, 'Goonswarm', 'CONDI', '2010-06-01', 1, 1, '2026-11-20');
