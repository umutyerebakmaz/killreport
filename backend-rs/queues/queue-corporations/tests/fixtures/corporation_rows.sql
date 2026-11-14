-- Three corporations, inserted out of ID order.
INSERT INTO public.corporations (id, name, ticker, member_count, ceo_id, creator_id, tax_rate, updated_at) VALUES
    (98000003, 'Third', 'THRD', 1, 90000001, 90000001, 0.1, CURRENT_TIMESTAMP),
    (98000001, 'First', 'FRST', 1, 90000001, 90000001, 0.1, CURRENT_TIMESTAMP),
    (98000002, 'Second', 'SCND', 1, 90000001, 90000001, 0.1, CURRENT_TIMESTAMP);
