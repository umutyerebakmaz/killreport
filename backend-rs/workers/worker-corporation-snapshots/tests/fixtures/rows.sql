-- Three corporations with 10, 5 and 3 members.
INSERT INTO public.corporations (id, name, ticker, member_count, ceo_id, creator_id, alliance_id, tax_rate, updated_at) VALUES
  (98000001, 'Corp One', 'C1', 10, 90000001, 90000001, 99000001, 0.1, '2026-01-01 00:00:00'),
  (98000002, 'Corp Two', 'C2', 5, 90000002, 90000002, NULL, 0.1, '2026-01-01 00:00:00'),
  (98000003, 'Corp Three', 'C3', 3, 90000003, 90000003, 99000003, 0.1, '2026-01-01 00:00:00');
