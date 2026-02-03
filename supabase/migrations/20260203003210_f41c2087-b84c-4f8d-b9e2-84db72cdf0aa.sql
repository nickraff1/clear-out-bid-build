
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'seller_admin', 'seller_staff', 'buyer_admin', 'buyer_staff');
CREATE TYPE public.org_type AS ENUM ('seller', 'buyer', 'fabricator');
CREATE TYPE public.pricing_type AS ENUM ('fixed', 'auction');
CREATE TYPE public.lot_condition AS ENUM ('unused', 'like_new', 'good', 'fair');
CREATE TYPE public.order_status AS ENUM ('pending_payment', 'paid', 'ready_for_pickup', 'collected', 'cancelled', 'disputed');
CREATE TYPE public.event_status AS ENUM ('draft', 'active', 'completed', 'cancelled');
CREATE TYPE public.lot_status AS ENUM ('draft', 'active', 'sold', 'unsold', 'cancelled');

-- ORGANIZATIONS
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_type public.org_type NOT NULL,
  abn TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  suburb TEXT,
  state TEXT,
  postcode TEXT,
  logo_url TEXT,
  is_approved BOOLEAN DEFAULT false,
  is_disabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PROFILES (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORG MEMBERS (join table)
CREATE TABLE public.org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id)
);

-- USER ROLES (separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  parent_id UUID REFERENCES public.categories(id),
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- COMPLIANCE TAGS
CREATE TABLE public.compliance_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLEARANCE EVENTS
CREATE TABLE public.clearance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  site_address TEXT NOT NULL,
  suburb TEXT NOT NULL,
  state TEXT,
  postcode TEXT,
  pickup_start TIMESTAMPTZ NOT NULL,
  pickup_end TIMESTAMPTZ NOT NULL,
  access_notes TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  status public.event_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOTS
CREATE TABLE public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.clearance_events(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id),
  title TEXT NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'each',
  condition public.lot_condition NOT NULL DEFAULT 'unused',
  pricing_type public.pricing_type NOT NULL DEFAULT 'fixed',
  fixed_price DECIMAL(12,2),
  start_price DECIMAL(12,2),
  reserve_price DECIMAL(12,2),
  current_bid DECIMAL(12,2),
  bid_count INT DEFAULT 0,
  auction_end TIMESTAMPTZ,
  status public.lot_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOT MEDIA
CREATE TABLE public.lot_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT DEFAULT 'image',
  is_primary BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- LOT COMPLIANCE TAGS (join table)
CREATE TABLE public.lot_compliance_tags (
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.compliance_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lot_id, tag_id)
);

-- BIDS
CREATE TABLE public.bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  amount DECIMAL(12,2) NOT NULL,
  is_winning BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- BID EVENTS (immutable audit log)
CREATE TABLE public.bid_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  org_id UUID NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'bid_placed',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id),
  buyer_org_id UUID NOT NULL REFERENCES public.organizations(id),
  lot_id UUID NOT NULL REFERENCES public.lots(id),
  event_id UUID NOT NULL REFERENCES public.clearance_events(id),
  amount DECIMAL(12,2) NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending_payment',
  payment_reference TEXT,
  pickup_slot_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PICKUP SLOTS
CREATE TABLE public.pickup_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.clearance_events(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  max_pickups INT DEFAULT 5,
  current_bookings INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for orders.pickup_slot_id
ALTER TABLE public.orders ADD CONSTRAINT orders_pickup_slot_fkey 
  FOREIGN KEY (pickup_slot_id) REFERENCES public.pickup_slots(id);

-- PICKUP CONFIRMATIONS
CREATE TABLE public.pickup_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  confirmed_by UUID NOT NULL REFERENCES public.profiles(id),
  photo_url TEXT,
  notes TEXT,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- WATCHLIST
CREATE TABLE public.watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, lot_id)
);

-- SAVED SEARCHES
CREATE TABLE public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  notify_email BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ADMIN AUDIT LOGS
CREATE TABLE public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ENABLE RLS ON ALL TABLES
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_compliance_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTION FOR ROLE CHECK
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- FUNCTION TO CHECK ORG MEMBERSHIP
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = _user_id AND org_id = _org_id
  )
$$;

-- FUNCTION TO CHECK IF USER IS ADMIN
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- APPLY UPDATED_AT TRIGGERS
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clearance_events_updated_at BEFORE UPDATE ON public.clearance_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lots_updated_at BEFORE UPDATE ON public.lots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PROFILE CREATION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS POLICIES

-- Profiles: users can view all, update own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Organizations: public read, members can update
CREATE POLICY "Anyone can view approved orgs" ON public.organizations FOR SELECT USING (is_approved = true OR public.is_admin(auth.uid()) OR public.is_org_member(auth.uid(), id));
CREATE POLICY "Org members can update org" ON public.organizations FOR UPDATE USING (public.is_org_member(auth.uid(), id) OR public.is_admin(auth.uid()));
CREATE POLICY "Authenticated users can create orgs" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Org Members
CREATE POLICY "Members can view their org members" ON public.org_members FOR SELECT USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Org admins can manage members" ON public.org_members FOR ALL USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

-- User Roles: only admins can manage, users can view own
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.is_admin(auth.uid()));

-- Categories: public read
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (public.is_admin(auth.uid()));

-- Compliance Tags: public read
CREATE POLICY "Anyone can view compliance tags" ON public.compliance_tags FOR SELECT USING (true);
CREATE POLICY "Admins can manage compliance tags" ON public.compliance_tags FOR ALL USING (public.is_admin(auth.uid()));

-- Clearance Events: public read active, org members manage
CREATE POLICY "Anyone can view active events" ON public.clearance_events FOR SELECT USING (status = 'active' OR public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));
CREATE POLICY "Org members can manage events" ON public.clearance_events FOR ALL USING (public.is_org_member(auth.uid(), org_id) OR public.is_admin(auth.uid()));

-- Lots: public read active
CREATE POLICY "Anyone can view active lots" ON public.lots FOR SELECT USING (
  status = 'active' OR 
  EXISTS (SELECT 1 FROM public.clearance_events ce WHERE ce.id = event_id AND public.is_org_member(auth.uid(), ce.org_id)) OR
  public.is_admin(auth.uid())
);
CREATE POLICY "Event owners can manage lots" ON public.lots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clearance_events ce WHERE ce.id = event_id AND public.is_org_member(auth.uid(), ce.org_id)) OR
  public.is_admin(auth.uid())
);

-- Lot Media
CREATE POLICY "Anyone can view lot media" ON public.lot_media FOR SELECT USING (true);
CREATE POLICY "Lot owners can manage media" ON public.lot_media FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.lots l 
    JOIN public.clearance_events ce ON ce.id = l.event_id 
    WHERE l.id = lot_id AND public.is_org_member(auth.uid(), ce.org_id)
  ) OR public.is_admin(auth.uid())
);

-- Lot Compliance Tags
CREATE POLICY "Anyone can view lot tags" ON public.lot_compliance_tags FOR SELECT USING (true);
CREATE POLICY "Lot owners can manage tags" ON public.lot_compliance_tags FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.lots l 
    JOIN public.clearance_events ce ON ce.id = l.event_id 
    WHERE l.id = lot_id AND public.is_org_member(auth.uid(), ce.org_id)
  ) OR public.is_admin(auth.uid())
);

-- Bids: public read on active lots, bidders can insert
CREATE POLICY "Anyone can view bids on active lots" ON public.bids FOR SELECT USING (true);
CREATE POLICY "Authenticated users can place bids" ON public.bids FOR INSERT WITH CHECK (auth.uid() = user_id AND public.is_org_member(auth.uid(), org_id));

-- Bid Events: public read
CREATE POLICY "Anyone can view bid events" ON public.bid_events FOR SELECT USING (true);
CREATE POLICY "System can insert bid events" ON public.bid_events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Orders
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (buyer_id = auth.uid() OR public.is_org_member(auth.uid(), buyer_org_id) OR public.is_admin(auth.uid()) OR 
  EXISTS (SELECT 1 FROM public.clearance_events ce WHERE ce.id = event_id AND public.is_org_member(auth.uid(), ce.org_id)));
CREATE POLICY "System can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Involved parties can update orders" ON public.orders FOR UPDATE USING (
  buyer_id = auth.uid() OR 
  public.is_org_member(auth.uid(), buyer_org_id) OR 
  public.is_admin(auth.uid()) OR
  EXISTS (SELECT 1 FROM public.clearance_events ce WHERE ce.id = event_id AND public.is_org_member(auth.uid(), ce.org_id))
);

-- Pickup Slots
CREATE POLICY "Anyone can view pickup slots" ON public.pickup_slots FOR SELECT USING (true);
CREATE POLICY "Event owners can manage pickup slots" ON public.pickup_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.clearance_events ce WHERE ce.id = event_id AND public.is_org_member(auth.uid(), ce.org_id)) OR
  public.is_admin(auth.uid())
);

-- Pickup Confirmations
CREATE POLICY "Involved parties can view confirmations" ON public.pickup_confirmations FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = auth.uid() OR public.is_org_member(auth.uid(), o.buyer_org_id))) OR
  public.is_admin(auth.uid())
);
CREATE POLICY "Involved parties can create confirmations" ON public.pickup_confirmations FOR INSERT WITH CHECK (auth.uid() = confirmed_by);

-- Watchlist
CREATE POLICY "Users can manage own watchlist" ON public.watchlist FOR ALL USING (auth.uid() = user_id);

-- Saved Searches
CREATE POLICY "Users can manage own saved searches" ON public.saved_searches FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Admin Audit Logs
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can create audit logs" ON public.admin_audit_logs FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_lots_event_id ON public.lots(event_id);
CREATE INDEX idx_lots_status ON public.lots(status);
CREATE INDEX idx_lots_category_id ON public.lots(category_id);
CREATE INDEX idx_lots_pricing_type ON public.lots(pricing_type);
CREATE INDEX idx_lots_auction_end ON public.lots(auction_end) WHERE pricing_type = 'auction';
CREATE INDEX idx_bids_lot_id ON public.bids(lot_id);
CREATE INDEX idx_bids_user_id ON public.bids(user_id);
CREATE INDEX idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX idx_orders_event_id ON public.orders(event_id);
CREATE INDEX idx_clearance_events_org_id ON public.clearance_events(org_id);
CREATE INDEX idx_clearance_events_status ON public.clearance_events(status);
CREATE INDEX idx_org_members_user_id ON public.org_members(user_id);
CREATE INDEX idx_org_members_org_id ON public.org_members(org_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_watchlist_user_id ON public.watchlist(user_id);
