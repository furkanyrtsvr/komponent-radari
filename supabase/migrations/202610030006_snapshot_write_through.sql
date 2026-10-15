-- Only the trusted server can record observations. Older concurrent reads cannot win.
CREATE OR REPLACE FUNCTION public.eub_save_catalog_snapshot(snapshot jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 INSERT INTO catalog_snapshots(id,store_id,url,checked_at,payload)
 VALUES(snapshot->>'id',snapshot->>'store_id',snapshot->>'url',snapshot->>'checked_at',snapshot->>'payload')
 ON CONFLICT(store_id,url) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload
 WHERE excluded.checked_at>catalog_snapshots.checked_at;
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected>0;
END $$;
REVOKE ALL ON FUNCTION public.eub_save_catalog_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_save_catalog_snapshot(jsonb) TO service_role;
