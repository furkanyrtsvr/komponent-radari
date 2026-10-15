-- A corrected reader can repair the same captured observation without retiming
-- a price. A newer actual observation always takes precedence.
CREATE OR REPLACE FUNCTION public.eub_save_catalog_snapshot(snapshot jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 INSERT INTO catalog_snapshots(id,store_id,url,checked_at,payload)
 VALUES(snapshot->>'id',snapshot->>'store_id',snapshot->>'url',snapshot->>'checked_at',snapshot->>'payload')
 ON CONFLICT(store_id,url) DO UPDATE SET checked_at=excluded.checked_at,payload=excluded.payload
 WHERE excluded.checked_at>catalog_snapshots.checked_at
 OR (excluded.checked_at=catalog_snapshots.checked_at
  AND COALESCE((excluded.payload::jsonb->>'readerRevision')::integer,0)>COALESCE((catalog_snapshots.payload::jsonb->>'readerRevision')::integer,0));
 GET DIAGNOSTICS affected = ROW_COUNT;
 RETURN affected>0;
END $$;
REVOKE ALL ON FUNCTION public.eub_save_catalog_snapshot(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_save_catalog_snapshot(jsonb) TO service_role;
