-- Update the handle_new_user trigger to include agreement timestamps
-- (termsAcceptedAt, ndaAcceptedAt, privacyAcceptedAt) from user_metadata.
--
-- Previously the trigger created a skeleton row without these fields,
-- causing a race condition with the API register endpoint: if the trigger
-- fired before prisma.user.create, the row would be missing the acceptance
-- timestamps. The API now uses upsert to handle this, but updating the
-- trigger ensures the data is correct even if only the trigger runs
-- (e.g. if the API create call fails after Supabase auth user is created).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    "firstName",
    "lastName",
    role,
    company,
    "licenseNumber",
    "termsAcceptedAt",
    "ndaAcceptedAt",
    "privacyAcceptedAt",
    "updatedAt"
  )
  VALUES (
    NEW.id::text,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'firstName',
      split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1)
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'lastName',
      NULLIF(
        split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2),
        ''
      ),
      ''
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::"UserRole",
      'BUYER'
    ),
    NEW.raw_user_meta_data->>'company',
    NEW.raw_user_meta_data->>'licenseNumber',
    CASE WHEN NEW.raw_user_meta_data->>'termsAcceptedAt' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'termsAcceptedAt')::TIMESTAMP(3)
         ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data->>'ndaAcceptedAt' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'ndaAcceptedAt')::TIMESTAMP(3)
         ELSE NULL END,
    CASE WHEN NEW.raw_user_meta_data->>'privacyAcceptedAt' IS NOT NULL
         THEN (NEW.raw_user_meta_data->>'privacyAcceptedAt')::TIMESTAMP(3)
         ELSE NULL END,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;
