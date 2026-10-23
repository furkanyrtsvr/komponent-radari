CREATE TABLE public.feedback_reports (
 id text PRIMARY KEY, user_id text NOT NULL REFERENCES public.users(id),
 title text NOT NULL, kind text NOT NULL, status text NOT NULL,
 context text NOT NULL, created_at text NOT NULL, updated_at text NOT NULL
);
CREATE INDEX feedback_owner_updated ON public.feedback_reports(user_id,updated_at);
CREATE INDEX feedback_updated ON public.feedback_reports(updated_at);
CREATE TABLE public.feedback_messages (
 id text PRIMARY KEY, report_id text NOT NULL REFERENCES public.feedback_reports(id),
 author_id text NOT NULL REFERENCES public.users(id), author_role text NOT NULL,
 body text NOT NULL, created_at text NOT NULL
);
CREATE INDEX feedback_conversation ON public.feedback_messages(report_id,created_at);
ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_messages ENABLE ROW LEVEL SECURITY;
-- API authentication and owner/admin checks precede service-role operations.
CREATE OR REPLACE FUNCTION public.eub_insert_batch(entries jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry jsonb; target text; BEGIN
 IF jsonb_array_length(entries)>500 THEN RAISE EXCEPTION 'batch too large'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(entries) LOOP
 target=entry->>'table';
 IF target NOT IN ('carts','cart_members','cart_items','cart_snapshots','saved_optimizations','store_offers','price_history','store_products','feedback_reports','feedback_messages') THEN RAISE EXCEPTION 'table not allowed'; END IF;
 EXECUTE format('INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I,$1)',target,target) USING entry->'row';
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.eub_insert_batch(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.eub_insert_batch(jsonb) TO service_role;
