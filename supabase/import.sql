-- One-time import of your Excel tracker. Run AFTER schema.sql and AFTER creating your user.
do $$
declare uid uuid := (select id from auth.users order by created_at limit 1);
begin
  if uid is null then raise exception 'Create your user first (Authentication > Users)'; end if;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'SKIL', '#6CC4FF', 'https://thomasmore.instructure.com/', null, 0) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'Data Tech', '#7C9CFF', 'https://thomasmore.instructure.com/', null, 1) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'Linux Web', '#4FD1C5', 'https://thomasmore.instructure.com/', null, 2) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'Com 2', '#F6AD55', 'https://thomasmore.instructure.com/', null, 3) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'Network', '#F687B3', 'https://thomasmore.instructure.com/', null, 4) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'WSE', '#9AE6B4', 'https://thomasmore.instructure.com/', null, 5) on conflict do nothing;
  insert into courses (user_id, name, color, canvas_url, site_url, sort) values (uid, 'APP Sec', '#B794F4', 'https://thomasmore.instructure.com/', null, 6) on conflict do nothing;
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Deadline 3: Concept- en analyserapport', 'SKIL', 'deadline', '2026-11-29', 'working');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Les 6', 'Data Tech', 'todo', '2026-11-18', 'done');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'THEORY EXAM', 'Linux Web', 'exam', '2026-12-01', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Mean Stack: Self Study', 'Linux Web', 'todo', '2026-11-24', 'working');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Preperation ethical committee', 'SKIL', 'deadline', '2026-12-02', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Les 7', 'Data Tech', 'todo', '2026-11-25', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Deadline 6: Hostingrapport', 'SKIL', 'deadline', '2026-12-03', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Examenplanning', null, 'todo', '2026-12-19', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'A 4: Banga game (be present)', 'Com 2', 'deadline', '2026-12-04', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Deadline 4: Time Mangement', 'SKIL', 'deadline', '2026-12-06', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Ethical committee', 'SKIL', 'deadline', '2026-12-09', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Refelection ethical committee', 'SKIL', 'deadline', '2026-12-09', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'A 1: Understanding my client', 'Com 2', 'deadline', '2026-12-11', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Test 2', 'Network', 'exam', '2026-12-15', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Deadline 5: Time Management', 'SKIL', 'deadline', '2026-12-17', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Deadline 4: User stories & PoC', 'SKIL', 'deadline', '2026-12-17', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Case Study', 'WSE', 'deadline', '2026-12-18', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'A 2: Report', 'Com 2', 'deadline', '2026-12-18', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Pentesting Project', 'APP Sec', 'exam', '2026-12-20', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Milestone: Document', 'Linux Web', 'deadline', '2027-01-10', 'working');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'A3: My cultural activity', 'Com 2', 'deadline', '2027-03-05', 'todo');
  insert into tasks (user_id, title, course, kind, due_date, status) values (uid, 'Final A: Growth Portfolio', 'Com 2', 'deadline', '2027-05-14', 'todo');
end $$;
