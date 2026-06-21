
-- ============ ENUM EXTENSIONS ============
ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'reserved';
ALTER TYPE lot_status ADD VALUE IF NOT EXISTS 'expired';

-- ============ LOTS extensions ============
ALTER TABLE public.lots
  ADD COLUMN IF NOT EXISTS buy_now_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS min_bid_increment numeric(12,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS reserve_met boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS retail_estimate numeric(12,2),
  ADD COLUMN IF NOT EXISTS prohibited_materials_confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS winning_bidder_id uuid;

-- ============ ORGANIZATIONS extensions ============
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_founding boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- ============ PROFILES extensions ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

-- ============ CATEGORIES extension ============
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS kg_per_unit numeric(10,3) DEFAULT 0;

-- ============ PAYMENTS extensions ============
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_transfer_id text,
  ADD COLUMN IF NOT EXISTS application_fee_amount numeric(12,2);

-- ============ SELLER STRIPE ACCOUNTS extensions ============
ALTER TABLE public.seller_stripe_accounts
  ADD COLUMN IF NOT EXISTS account_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payouts_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS details_submitted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS charges_enabled boolean DEFAULT false;

-- ============ FEE SETTINGS (singleton) ============
CREATE TABLE IF NOT EXISTS public.fee_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_fee_pct numeric(5,4) NOT NULL DEFAULT 0.05,
  seller_fee_pct numeric(5,4) NOT NULL DEFAULT 0.05,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true UNIQUE
);
GRANT SELECT ON public.fee_settings TO anon, authenticated;
GRANT ALL ON public.fee_settings TO service_role;
ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view fee settings" ON public.fee_settings FOR SELECT USING (true);
CREATE POLICY "Admins can update fee settings" ON public.fee_settings FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can insert fee settings" ON public.fee_settings FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
INSERT INTO public.fee_settings (buyer_fee_pct, seller_fee_pct) VALUES (0.05, 0.05) ON CONFLICT DO NOTHING;

-- ============ SELLER BADGES ============
CREATE TABLE IF NOT EXISTS public.seller_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  badge text NOT NULL CHECK (badge IN ('verified','founding','top_seller')),
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES auth.users(id),
  UNIQUE(org_id, badge)
);
GRANT SELECT ON public.seller_badges TO anon, authenticated;
GRANT ALL ON public.seller_badges TO service_role;
ALTER TABLE public.seller_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view badges" ON public.seller_badges FOR SELECT USING (true);
CREATE POLICY "Admins manage badges" ON public.seller_badges FOR ALL TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- ============ REVIEWS ============
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL,
  reviewee_org_id uuid REFERENCES public.organizations(id),
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('buyer','seller')),
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(order_id, reviewer_id)
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Order participants can review" ON public.reviews FOR INSERT TO authenticated WITH CHECK (
  reviewer_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.status = 'collected'
      AND (o.buyer_id = auth.uid() OR is_org_member(auth.uid(), get_event_org_id(o.event_id)))
  )
);

-- ============ CONVERSATIONS + MESSAGES ============
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(buyer_id, seller_org_id, lot_id)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants view conversations" ON public.conversations FOR SELECT TO authenticated USING (
  buyer_id = auth.uid() OR is_org_member(auth.uid(), seller_org_id)
);
CREATE POLICY "Buyer creates conversation" ON public.conversations FOR INSERT TO authenticated WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Participants update conversation" ON public.conversations FOR UPDATE TO authenticated USING (
  buyer_id = auth.uid() OR is_org_member(auth.uid(), seller_org_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conv_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv_id
      AND (c.buyer_id = _user_id OR is_org_member(_user_id, c.seller_org_id))
  )
$$;

CREATE POLICY "Participants view messages" ON public.messages FOR SELECT TO authenticated USING (
  is_conversation_participant(auth.uid(), conversation_id)
);
CREATE POLICY "Participants send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND is_conversation_participant(auth.uid(), conversation_id)
);
CREATE POLICY "Recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (
  is_conversation_participant(auth.uid(), conversation_id)
);

-- ============ LOT REPORTS ============
CREATE TABLE IF NOT EXISTS public.lot_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','resolved','dismissed')),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.lot_reports TO authenticated;
GRANT ALL ON public.lot_reports TO service_role;
ALTER TABLE public.lot_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users file reports" ON public.lot_reports FOR INSERT TO authenticated WITH CHECK (reporter_id = auth.uid());
CREATE POLICY "Reporter views own" ON public.lot_reports FOR SELECT TO authenticated USING (reporter_id = auth.uid() OR is_admin(auth.uid()));
CREATE POLICY "Admin updates reports" ON public.lot_reports FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- ============ SAVED SEARCH ALERTS ============
CREATE TABLE IF NOT EXISTS public.saved_search_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  saved_search_id uuid NOT NULL REFERENCES public.saved_searches(id) ON DELETE CASCADE,
  lot_id uuid NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE(saved_search_id, lot_id)
);
GRANT SELECT, UPDATE ON public.saved_search_alerts TO authenticated;
GRANT ALL ON public.saved_search_alerts TO service_role;
ALTER TABLE public.saved_search_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own alerts" ON public.saved_search_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users mark own alerts read" ON public.saved_search_alerts FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============ BULK IMPORTS ============
CREATE TABLE IF NOT EXISTS public.bulk_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.clearance_events(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  file_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','previewing','publishing','complete','failed')),
  rows_total int NOT NULL DEFAULT 0,
  rows_ok int NOT NULL DEFAULT 0,
  rows_error int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_imports TO authenticated;
GRANT ALL ON public.bulk_imports TO service_role;
ALTER TABLE public.bulk_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members manage bulk imports" ON public.bulk_imports FOR ALL TO authenticated USING (
  is_org_member(auth.uid(), seller_org_id) OR is_admin(auth.uid())
) WITH CHECK (
  is_org_member(auth.uid(), seller_org_id)
);

CREATE TABLE IF NOT EXISTS public.bulk_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.bulk_imports(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ok','error')),
  error text,
  lot_id uuid REFERENCES public.lots(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bulk_import_rows TO authenticated;
GRANT ALL ON public.bulk_import_rows TO service_role;
ALTER TABLE public.bulk_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access import rows" ON public.bulk_import_rows FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bulk_imports bi WHERE bi.id = import_id AND (is_org_member(auth.uid(), bi.seller_org_id) OR is_admin(auth.uid())))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.bulk_imports bi WHERE bi.id = import_id AND is_org_member(auth.uid(), bi.seller_org_id))
);

-- ============ ANALYTICS EVENTS ============
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  props jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_name ON public.analytics_events(event_name, created_at DESC);
GRANT INSERT ON public.analytics_events TO anon, authenticated;
GRANT SELECT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone logs events" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin reads events" ON public.analytics_events FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_bulk_imports_updated BEFORE UPDATE ON public.bulk_imports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update org rating when review is added
CREATE OR REPLACE FUNCTION public.update_org_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reviewee_org_id IS NOT NULL THEN
    UPDATE public.organizations
    SET rating_avg = (SELECT AVG(rating)::numeric(3,2) FROM public.reviews WHERE reviewee_org_id = NEW.reviewee_org_id),
        rating_count = (SELECT COUNT(*) FROM public.reviews WHERE reviewee_org_id = NEW.reviewee_org_id)
    WHERE id = NEW.reviewee_org_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reviews_update_org_rating AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_org_rating();

-- Bump conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_conversation_timestamp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_messages_bump_conv AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_timestamp();
