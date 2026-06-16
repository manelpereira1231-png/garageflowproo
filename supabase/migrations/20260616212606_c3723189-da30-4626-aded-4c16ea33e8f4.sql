
-- 0) Add super_admin to app_role enum so user_roles can carry it
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
