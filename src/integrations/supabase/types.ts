export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_data: Json | null
          old_data: Json | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bid_events: {
        Row: {
          amount: number
          bid_id: string
          created_at: string
          event_type: string
          id: string
          lot_id: string
          metadata: Json | null
          org_id: string
          user_id: string
        }
        Insert: {
          amount: number
          bid_id: string
          created_at?: string
          event_type?: string
          id?: string
          lot_id: string
          metadata?: Json | null
          org_id: string
          user_id: string
        }
        Update: {
          amount?: number
          bid_id?: string
          created_at?: string
          event_type?: string
          id?: string
          lot_id?: string
          metadata?: Json | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bid_events_bid_id_fkey"
            columns: ["bid_id"]
            isOneToOne: false
            referencedRelation: "bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bid_events_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      bids: {
        Row: {
          amount: number
          created_at: string
          id: string
          is_winning: boolean | null
          lot_id: string
          org_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          is_winning?: boolean | null
          lot_id: string
          org_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          is_winning?: boolean | null
          lot_id?: string
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bids_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      clearance_events: {
        Row: {
          access_notes: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          org_id: string
          pickup_end: string
          pickup_start: string
          postcode: string | null
          site_address: string
          state: string | null
          status: Database["public"]["Enums"]["event_status"]
          suburb: string
          title: string
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          org_id: string
          pickup_end: string
          pickup_start: string
          postcode?: string | null
          site_address: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          suburb: string
          title: string
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          org_id?: string
          pickup_end?: string
          pickup_start?: string
          postcode?: string | null
          site_address?: string
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          suburb?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearance_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_tags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      lot_compliance_tags: {
        Row: {
          lot_id: string
          tag_id: string
        }
        Insert: {
          lot_id: string
          tag_id: string
        }
        Update: {
          lot_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_compliance_tags_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_compliance_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "compliance_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_media: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          lot_id: string
          sort_order: number | null
          type: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          lot_id: string
          sort_order?: number | null
          type?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          lot_id?: string
          sort_order?: number | null
          type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_media_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          auction_end: string | null
          bid_count: number | null
          category_id: string | null
          condition: Database["public"]["Enums"]["lot_condition"]
          created_at: string
          current_bid: number | null
          description: string | null
          event_id: string
          fixed_price: number | null
          id: string
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          quantity: number
          reserve_price: number | null
          start_price: number | null
          status: Database["public"]["Enums"]["lot_status"]
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          auction_end?: string | null
          bid_count?: number | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["lot_condition"]
          created_at?: string
          current_bid?: number | null
          description?: string | null
          event_id: string
          fixed_price?: number | null
          id?: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          quantity?: number
          reserve_price?: number | null
          start_price?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          auction_end?: string | null
          bid_count?: number | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["lot_condition"]
          created_at?: string
          current_bid?: number | null
          description?: string | null
          event_id?: string
          fixed_price?: number | null
          id?: string
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          quantity?: number
          reserve_price?: number | null
          start_price?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          buyer_id: string
          buyer_org_id: string
          created_at: string
          event_id: string
          id: string
          lot_id: string
          notes: string | null
          payment_reference: string | null
          pickup_slot_id: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          buyer_id: string
          buyer_org_id: string
          created_at?: string
          event_id: string
          id?: string
          lot_id: string
          notes?: string | null
          payment_reference?: string | null
          pickup_slot_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          buyer_org_id?: string
          created_at?: string
          event_id?: string
          id?: string
          lot_id?: string
          notes?: string | null
          payment_reference?: string | null
          pickup_slot_id?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_org_id_fkey"
            columns: ["buyer_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_pickup_slot_fkey"
            columns: ["pickup_slot_id"]
            isOneToOne: false
            referencedRelation: "pickup_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          org_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          org_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          abn: string | null
          address: string | null
          created_at: string
          email: string | null
          id: string
          is_approved: boolean | null
          is_disabled: boolean | null
          logo_url: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone: string | null
          postcode: string | null
          state: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          abn?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_disabled?: boolean | null
          logo_url?: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          abn?: string | null
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_disabled?: boolean | null
          logo_url?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          postcode?: string | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_charged: number
          base_amount: number
          buyer_fee: number
          created_at: string
          error_message: string | null
          id: string
          order_id: string
          payment_method: string | null
          seller_fee: number
          seller_payout: number
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_charged: number
          base_amount: number
          buyer_fee?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id: string
          payment_method?: string | null
          seller_fee?: number
          seller_payout?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_charged?: number
          base_amount?: number
          buyer_fee?: number
          created_at?: string
          error_message?: string | null
          id?: string
          order_id?: string
          payment_method?: string | null
          seller_fee?: number
          seller_payout?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_confirmations: {
        Row: {
          confirmed_at: string
          confirmed_by: string
          id: string
          notes: string | null
          order_id: string
          photo_url: string | null
        }
        Insert: {
          confirmed_at?: string
          confirmed_by: string
          id?: string
          notes?: string | null
          order_id: string
          photo_url?: string | null
        }
        Update: {
          confirmed_at?: string
          confirmed_by?: string
          id?: string
          notes?: string | null
          order_id?: string
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_confirmations_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_slots: {
        Row: {
          created_at: string
          current_bookings: number | null
          end_time: string
          event_id: string
          id: string
          max_pickups: number | null
          start_time: string
        }
        Insert: {
          created_at?: string
          current_bookings?: number | null
          end_time: string
          event_id: string
          id?: string
          max_pickups?: number | null
          start_time: string
        }
        Update: {
          created_at?: string
          current_bookings?: number | null
          end_time?: string
          event_id?: string
          id?: string
          max_pickups?: number | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickup_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickup_slots_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events_public"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          name: string
          notify_email: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string
          filters: Json
          id?: string
          name: string
          notify_email?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          name?: string
          notify_email?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stripe_accounts: {
        Row: {
          created_at: string
          details_submitted: boolean | null
          id: string
          onboarding_complete: boolean | null
          org_id: string
          payouts_enabled: boolean | null
          stripe_account_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          org_id: string
          payouts_enabled?: boolean | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          details_submitted?: boolean | null
          id?: string
          onboarding_complete?: boolean | null
          org_id?: string
          payouts_enabled?: boolean | null
          stripe_account_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_stripe_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          lot_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lot_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lot_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clearance_events_public: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string | null
          org_id: string | null
          pickup_end: string | null
          pickup_start: string | null
          postcode: string | null
          site_address: string | null
          state: string | null
          status: Database["public"]["Enums"]["event_status"] | null
          suburb: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          org_id?: string | null
          pickup_end?: string | null
          pickup_start?: string | null
          postcode?: string | null
          site_address?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          suburb?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string | null
          org_id?: string | null
          pickup_end?: string | null
          pickup_start?: string | null
          postcode?: string | null
          site_address?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["event_status"] | null
          suburb?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clearance_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clearance_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_bid_stats: {
        Row: {
          bid_count: number | null
          highest_bid: number | null
          lot_id: string | null
          lowest_bid: number | null
          unique_bidders: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_event_org_id: { Args: { _event_id: string }; Returns: string }
      has_order_for_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "seller_admin"
        | "seller_staff"
        | "buyer_admin"
        | "buyer_staff"
      event_status: "draft" | "active" | "completed" | "cancelled"
      lot_condition: "unused" | "like_new" | "good" | "fair"
      lot_status: "draft" | "active" | "sold" | "unsold" | "cancelled"
      order_status:
        | "pending_payment"
        | "paid"
        | "ready_for_pickup"
        | "collected"
        | "cancelled"
        | "disputed"
      org_type: "seller" | "buyer" | "fabricator"
      payment_status:
        | "pending"
        | "processing"
        | "succeeded"
        | "failed"
        | "refunded"
      pricing_type: "fixed" | "auction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "seller_admin",
        "seller_staff",
        "buyer_admin",
        "buyer_staff",
      ],
      event_status: ["draft", "active", "completed", "cancelled"],
      lot_condition: ["unused", "like_new", "good", "fair"],
      lot_status: ["draft", "active", "sold", "unsold", "cancelled"],
      order_status: [
        "pending_payment",
        "paid",
        "ready_for_pickup",
        "collected",
        "cancelled",
        "disputed",
      ],
      org_type: ["seller", "buyer", "fabricator"],
      payment_status: [
        "pending",
        "processing",
        "succeeded",
        "failed",
        "refunded",
      ],
      pricing_type: ["fixed", "auction"],
    },
  },
} as const
