// Custom database types for Offcutt

export type AppRole = 'admin' | 'seller_admin' | 'seller_staff' | 'buyer_admin' | 'buyer_staff';
export type OrgType = 'seller' | 'buyer' | 'fabricator';
export type PricingType = 'fixed' | 'auction';
export type LotCondition = 'unused' | 'like_new' | 'good' | 'fair';
export type OrderStatus = 'pending_payment' | 'paid' | 'ready_for_pickup' | 'collected' | 'cancelled' | 'disputed';
export type PickupStatus =
  | 'awaiting_arrangement'
  | 'pickup_proposed'
  | 'pickup_confirmed'
  | 'ready_for_pickup'
  | 'collected_pending_seller_confirmation'
  | 'completed'
  | 'issue_reported';
export type EventStatus = 'draft' | 'active' | 'completed' | 'cancelled';
export type LotStatus = 'draft' | 'active' | 'reserved' | 'sold' | 'unsold' | 'cancelled';

export interface Organization {
  id: string;
  name: string;
  org_type: OrgType;
  abn?: string;
  phone?: string;
  email?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  logo_url?: string;
  is_approved: boolean;
  is_disabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  org_id: string;
  is_primary: boolean;
  created_at: string;
  organization?: Organization;
  profile?: Profile;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  parent_id?: string;
  sort_order: number;
  created_at: string;
}

export interface ComplianceTag {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ClearanceEvent {
  id: string;
  org_id: string;
  created_by: string;
  title: string;
  description?: string;
  site_address: string;
  suburb: string;
  state?: string;
  postcode?: string;
  pickup_start: string;
  pickup_end: string;
  access_notes?: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  organization?: Organization;
  lots?: Lot[];
}

export interface Lot {
  id: string;
  event_id: string;
  category_id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit: string;
  condition: LotCondition;
  pricing_type: PricingType;
  fixed_price?: number;
  start_price?: number;
  reserve_price?: number;
  current_bid?: number;
  bid_count: number;
  auction_end?: string;
  status: LotStatus;
  created_at: string;
  updated_at: string;
  category?: Category;
  event?: ClearanceEvent;
  media?: LotMedia[];
  compliance_tags?: ComplianceTag[];
}

export interface LotMedia {
  id: string;
  lot_id: string;
  url: string;
  type: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface Bid {
  id: string;
  lot_id: string;
  user_id: string;
  org_id: string;
  amount: number;
  is_winning: boolean;
  created_at: string;
  profile?: Profile;
  organization?: Organization;
}

export interface Order {
  id: string;
  buyer_id: string;
  buyer_org_id: string;
  lot_id: string;
  event_id: string;
  amount: number;
  status: OrderStatus;
  payment_reference?: string;
  pickup_slot_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  pickup_code?: string;
  pickup_status?: PickupStatus;
  proposed_pickup_at?: string;
  proposed_pickup_by?: string;
  agreed_pickup_at?: string;
  buyer_collected_at?: string;
  seller_confirmed_at?: string;
  admin_notes?: string;
  lot?: Lot;
  event?: ClearanceEvent;
  buyer?: Profile;
  buyer_org?: Organization;
  pickup_slot?: PickupSlot;
}

export interface PickupSlot {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  max_pickups: number;
  current_bookings: number;
  created_at: string;
}

export interface PickupConfirmation {
  id: string;
  order_id: string;
  confirmed_by: string;
  photo_url?: string;
  notes?: string;
  confirmed_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  lot_id: string;
  created_at: string;
  lot?: Lot;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  filters: Record<string, unknown>;
  notify_email: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// Extended types for UI
export interface LotWithDetails extends Lot {
  event: ClearanceEvent;
  category: Category | null;
  media: LotMedia[];
  compliance_tags: ComplianceTag[];
  bid_count: number;
}

export interface EventWithDetails extends ClearanceEvent {
  organization: Organization;
  lots: Lot[];
  lot_count?: number;
}
