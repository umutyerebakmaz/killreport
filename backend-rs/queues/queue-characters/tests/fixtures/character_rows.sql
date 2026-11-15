-- Three characters, inserted out of ID order.
INSERT INTO public.characters (id, name, corporation_id, birthday, bloodline_id, race_id, gender, updated_at) VALUES
    (2120000003, 'Third', 98000001, CURRENT_TIMESTAMP, 1, 1, 'male', CURRENT_TIMESTAMP),
    (2120000001, 'First', 98000001, CURRENT_TIMESTAMP, 1, 1, 'male', CURRENT_TIMESTAMP),
    (2120000002, 'Second', 98000001, CURRENT_TIMESTAMP, 1, 1, 'male', CURRENT_TIMESTAMP);
