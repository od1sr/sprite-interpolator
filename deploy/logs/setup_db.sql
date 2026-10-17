DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sprite') THEN
    CREATE ROLE sprite LOGIN PASSWORD 'sprite' SUPERUSER;
  END IF;
END
$$;
