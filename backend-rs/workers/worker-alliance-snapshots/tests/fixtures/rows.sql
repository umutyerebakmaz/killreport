-- 99000001: two corporations (10 and 5 members). 99000002: none. Every
-- alliance carries stale counts (999). 99000003: one corporation (3 members). Corporation 98000004 points
-- at an alliance that is not in the table; 98000005 has no alliance.
INSERT INTO public.alliances (id, name, ticker, date_founded, creator_corporation_id, creator_id, updated_at, member_count, corporation_count) VALUES
  (99000001, 'Alpha', 'ALPHA', '2020-01-01', 98000001, 90000001, '2026-01-01 00:00:00', 999, 999),
  (99000002, 'Beta', 'BETA', '2020-01-01', 98000002, 90000002, '2026-01-01 00:00:00', 999, 999),
  (99000003, 'Gamma', 'GAMMA', '2020-01-01', 98000003, 90000003, '2026-01-01 00:00:00', 999, 999);
INSERT INTO public.corporations (id, name, ticker, member_count, ceo_id, creator_id, alliance_id, tax_rate, updated_at) VALUES
  (98000001, 'Corp One', 'C1', 10, 90000001, 90000001, 99000001, 0.1, '2026-01-01 00:00:00'),
  (98000002, 'Corp Two', 'C2', 5, 90000002, 90000002, 99000001, 0.1, '2026-01-01 00:00:00'),
  (98000003, 'Corp Three', 'C3', 3, 90000003, 90000003, 99000003, 0.1, '2026-01-01 00:00:00'),
  (98000004, 'Corp Four', 'C4', 50, 90000004, 90000004, 99999999, 0.1, '2026-01-01 00:00:00'),
  (98000005, 'Corp Five', 'C5', 20, 90000005, 90000005, NULL, 0.1, '2026-01-01 00:00:00');
