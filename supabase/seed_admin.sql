-- Promote a user to TaraWorld admin.
-- 1) Sign up / log in once so a row exists in public.profiles.
-- 2) Find the auth user id (Supabase Dashboard → Authentication → Users,
--    or: select id, email from auth.users;).
-- 3) Run:

update public.profiles
set role = 'admin',
    updated_at = now()
where id = '00000000-0000-0000-0000-000000000000'; -- <-- replace with real UUID

-- Verify:
-- select id, name, phone, role, is_banned from public.profiles where role = 'admin';

-- Demote (if needed):
-- update public.profiles set role = 'user' where id = '...';

-- Optional: bootstrap by email when ADMIN_BOOTSTRAP_EMAIL is known (run in SQL editor):
-- update public.profiles p
-- set role = 'admin', updated_at = now()
-- from auth.users u
-- where p.id = u.id
--   and lower(u.email) = lower('you@example.com');
