\set ON_ERROR_STOP on
\pset footer off

set role anon;
do $$
declare denied boolean := false;
begin
  if (select count(*) from public.cohort_messages) <> 0
     or (select count(*) from public.cohort_message_attachments) <> 0
     or (select count(*) from public.cohort_channels) <> 0 then
    raise exception 'FAIL: guest can read private Aula rows';
  end if;
  begin
    insert into public.cohort_messages (cohort_id, user_id, content)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Guest write');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: guest message insert succeeded'; end if;
  raise notice 'PASS: guest reads no Aula rows and cannot insert a message';
end $$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $$
declare affected bigint;
begin
  if (select count(*) from public.cohort_messages) <> 3 then raise exception 'FAIL: member A message scope'; end if;
  if (select count(*) from public.cohort_channels) <> 3 then raise exception 'FAIL: member A channel scope'; end if;
  if (select count(*) from public.cohort_message_attachments) <> 2 then raise exception 'FAIL: member A attachment scope or legacy metadata leak'; end if;
  if exists (select 1 from public.cohort_messages where cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and content ilike '%needle%') then
    raise exception 'FAIL: chosen foreign cohort returns message search hits';
  end if;
  if exists (
    select 1 from public.cohort_message_attachments attachment
    join public.cohort_messages message on message.id = attachment.message_id
    where message.cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and attachment.file_name ilike '%needle%'
  ) then raise exception 'FAIL: chosen foreign cohort returns attachment search hits'; end if;
  update public.cohort_messages set content = 'Edited needle A' where id = 1001;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: current author cannot edit own message'; end if;
  update public.cohort_channels set name = 'Edited channel A' where id = 101;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: current creator cannot edit own channel'; end if;
  raise notice 'PASS: member search cannot cross cohorts; valid own edits remain usable';
end $$;

do $$
declare denied boolean := false;
begin
  begin
    insert into public.cohort_members (cohort_id, user_id)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: authenticated user directly joined a foreign cohort'; end if;
  denied := false;
  begin
    insert into public.cohort_messages (cohort_id, user_id, content)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Foreign cohort write');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: nonmember inserted a message into a foreign cohort'; end if;
  insert into public.cohort_messages (cohort_id, user_id, content, parent_id, channel_id)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Valid same-cohort reply', 1001, 101);
  raise notice 'PASS: direct self-join/foreign insert denied; valid same-cohort reply accepted';
end $$;

-- Supplied non-null cohort IDs must not override the parent relationship.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.cohort_message_attachments
      (message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes)
    values (1001, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'fixture', 'forged.pdf', 'application/pdf', 10);
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: attachment accepted forged cohort_id'; end if;
  insert into public.cohort_message_attachments
    (message_id, user_id, storage_path, file_name, mime_type, size_bytes)
  values (1001, '11111111-1111-1111-1111-111111111111', 'fixture', 'valid.pdf', 'application/pdf', 10);
  if not exists (select 1 from public.cohort_message_attachments where file_name = 'valid.pdf' and cohort_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception 'FAIL: valid attachment no longer derives its parent cohort';
  end if;
  raise notice 'PASS: attachment rejects forged scope and derives valid missing scope';
end $$;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$
declare affected bigint;
begin
  if (select count(*) from public.cohort_messages) <> 1
     or (select count(*) from public.cohort_message_attachments) <> 1
     or (select count(*) from public.cohort_channels) <> 1 then
    raise exception 'FAIL: member B scope or malformed legacy attachment visible';
  end if;
  update public.cohort_messages set content = 'Foreign edit' where id = 1001;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: member B changed member A message'; end if;
  raise notice 'PASS: reverse cohort isolation and foreign-author update denial';
end $$;

-- Membership in both cohorts still must not allow moving existing history.
select set_config('request.jwt.claim.sub', '33333333-3333-3333-3333-333333333333', false);
do $$
declare denied boolean := false;
begin
  begin
    update public.cohort_messages set cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 1004;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: author moved a message into another cohort'; end if;
  denied := false;
  begin
    update public.cohort_channels set cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 104;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: creator moved a channel into another cohort'; end if;
  denied := false;
  begin
    update public.cohort_messages set parent_id = 1002 where id = 1004;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: message accepted a parent from another cohort'; end if;
  denied := false;
  begin
    update public.cohort_messages set channel_id = 102 where id = 1004;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: message accepted a channel from another cohort'; end if;
  raise notice 'PASS: message/channel cohorts immutable; cross-cohort parents/channels rejected';
end $$;

-- Deliberately omit WHERE/RETURNING: owner-only UPDATE/DELETE policies must
-- not allow a departed member to write old rows without needing SELECT rights.
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
do $$
declare affected bigint;
begin
  update public.cohort_messages set content = 'Former author edit';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: departed member edited old messages'; end if;
  delete from public.cohort_messages;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: departed member deleted old messages'; end if;
  update public.cohort_channels set name = 'Former creator edit';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: departed creator edited old channels'; end if;
  delete from public.cohort_message_attachments;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'FAIL: departed member deleted old attachments'; end if;
  raise notice 'PASS: departing a cohort removes message/channel/attachment mutation rights';
end $$;
reset role;

do $$
begin
  if not exists (select 1 from public.cohort_messages where id = 1003 and content = 'Former needle A')
     or not exists (select 1 from public.cohort_channels where id = 103 and name = 'Former channel A')
     or not exists (select 1 from public.cohort_message_attachments where id = 2004) then
    raise exception 'FAIL: denied mutations changed departed-member fixtures';
  end if;
  if not exists (select 1 from public.cohort_messages where id = 1004 and cohort_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' and parent_id is null and channel_id = 104)
     or not exists (select 1 from public.cohort_channels where id = 104 and cohort_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') then
    raise exception 'FAIL: denied scope mutation changed message/channel fixtures';
  end if;
  if not exists (select 1 from public.cohort_message_attachments where id = 2003) then
    raise exception 'FAIL: migration unexpectedly removed a legacy row';
  end if;
  raise notice 'PASS: denied writes left fixtures unchanged; legacy rows retained';
end $$;

-- Service operations keep their existing BYPASSRLS authority to maintain rows
-- independently of membership. Scope triggers still protect the relationships.
set role service_role;
select set_config('request.jwt.claim.sub', '', false);
do $$
declare affected bigint; denied boolean := false;
begin
  update public.cohort_messages set content = 'Service maintained former needle A' where id = 1003;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: service cannot maintain an existing message'; end if;
  update public.cohort_channels set name = 'Service maintained former channel A' where id = 103;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FAIL: service cannot maintain an existing channel'; end if;
  insert into public.cohort_message_attachments
    (message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes)
  values (1002, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'fixture-service', 'service-b.pdf', 'application/pdf', 10);
  if not exists (select 1 from public.cohort_message_attachments where file_name = 'service-b.pdf')
     or not exists (select 1 from public.cohort_messages where id = 1001)
     or not exists (select 1 from public.cohort_messages where id = 1002) then
    raise exception 'FAIL: valid service writes or cross-cohort maintenance reads regressed';
  end if;
  begin
    update public.cohort_messages set cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 1003;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: service moved a message to another cohort'; end if;
  denied := false;
  begin
    update public.cohort_channels set cohort_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' where id = 103;
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: service moved a channel to another cohort'; end if;
  denied := false;
  begin
    insert into public.cohort_message_attachments
      (message_id, cohort_id, user_id, storage_path, file_name, mime_type, size_bytes)
    values (1002, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'fixture-service', 'service-forged.pdf', 'application/pdf', 10);
  exception when check_violation then denied := true;
  end;
  if not denied then raise exception 'FAIL: service created an attachment with mismatched scope'; end if;
  raise notice 'PASS: service maintenance bypasses membership RLS while preserving scope integrity';
end $$;
reset role;

\echo 'PASS: all local Aula scope and RLS assertions completed'
