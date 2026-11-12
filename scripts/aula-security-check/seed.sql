\set ON_ERROR_STOP on

insert into public.profiles (id, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'Member A'),
  ('22222222-2222-2222-2222-222222222222', 'Member B'),
  ('33333333-3333-3333-3333-333333333333', 'Member A and B'),
  ('44444444-4444-4444-4444-444444444444', 'Former member A');
insert into public.cohorts (id, study_program, year_started, study_mode, name, slug) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Fixture A', 2026, 'stacjonarne', 'Fixture A', 'fixture-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Fixture B', 2026, 'stacjonarne', 'Fixture B', 'fixture-b');
insert into public.cohort_members (cohort_id, user_id) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444');
insert into public.cohort_channels (id, cohort_id, slug, name, created_by) values
  (101, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'channel-a', 'Channel A', '11111111-1111-1111-1111-111111111111'),
  (102, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'channel-b', 'Channel B', '22222222-2222-2222-2222-222222222222'),
  (103, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'former-a', 'Former channel A', '44444444-4444-4444-4444-444444444444'),
  (104, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'both-a', 'Both channel A', '33333333-3333-3333-3333-333333333333');
insert into public.cohort_messages (id, cohort_id, user_id, content, channel_id) values
  (1001, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Needle A', 101),
  (1002, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Needle B', 102),
  (1003, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'Former needle A', 103),
  (1004, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'Both needle A', 104);
insert into public.cohort_message_attachments
  (id, message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes) values
  (2001, 1001, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/11111111-1111-1111-1111-111111111111/a.pdf', 'needle-a.pdf', 'application/pdf', 10),
  (2002, 1002, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/22222222-2222-2222-2222-222222222222/b.pdf', 'needle-b.pdf', 'application/pdf', 10),
  -- Deliberately malformed legacy row: retained physically, hidden by the fix.
  (2003, 1002, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/22222222-2222-2222-2222-222222222222/legacy.pdf', 'legacy-b.pdf', 'application/pdf', 10),
  (2004, 1003, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/44444444-4444-4444-4444-444444444444/former.pdf', 'former-a.pdf', 'application/pdf', 10);
delete from public.cohort_members where user_id = '44444444-4444-4444-4444-444444444444';
