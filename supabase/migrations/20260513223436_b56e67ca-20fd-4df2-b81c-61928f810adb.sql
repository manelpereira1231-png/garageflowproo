INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT s.user_id, 'garage_owner'::public.app_role
FROM public.shops s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = s.user_id
      AND ur.role = 'garage_owner'::public.app_role
  );