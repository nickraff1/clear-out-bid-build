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
      analytics_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          props: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          props?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          props?: Json | null
          user_id?: string | null
        }
        Relationships: []
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
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
      bulk_import_rows: {
        Row: {
          created_at: string
          error: string | null
          id: string
          import_id: string
          lot_id: string | null
          payload: Json
          row_index: number
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          import_id: string
          lot_id?: string | null
          payload: Json
          row_index: number
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          import_id?: string
          lot_id?: string | null
          payload?: Json
          row_index?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_import_rows_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bulk_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_import_rows_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "bulk_import_rows_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_imports: {
        Row: {
          created_at: string
          created_by: string
          event_id: string | null
          file_name: string | null
          id: string
          rows_error: number
          rows_ok: number
          rows_total: number
          seller_org_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          event_id?: string | null
          file_name?: string | null
          id?: string
          rows_error?: number
          rows_ok?: number
          rows_total?: number
          seller_org_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          event_id?: string | null
          file_name?: string | null
          id?: string
          rows_error?: number
          rows_ok?: number
          rows_total?: number
          seller_org_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bulk_imports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_imports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "clearance_events_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bulk_imports_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          kg_per_unit: number | null
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
          kg_per_unit?: number | null
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
          kg_per_unit?: number | null
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
      conversations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          last_message_at: string
          lot_id: string | null
          order_id: string | null
          seller_org_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          last_message_at?: string
          lot_id?: string | null
          order_id?: string | null
          seller_org_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          last_message_at?: string
          lot_id?: string | null
          order_id?: string | null
          seller_org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "conversations_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_org_id_fkey"
            columns: ["seller_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_settings: {
        Row: {
          buyer_fee_pct: number
          id: string
          seller_fee_pct: number
          singleton: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          buyer_fee_pct?: number
          id?: string
          seller_fee_pct?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          buyer_fee_pct?: number
          id?: string
          seller_fee_pct?: number
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "lot_media_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          lot_id: string
          order_id: string | null
          reason: string
          reporter_id: string
          reporter_role: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          lot_id: string
          order_id?: string | null
          reason: string
          reporter_id: string
          reporter_role?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          lot_id?: string
          order_id?: string | null
          reason?: string
          reporter_id?: string
          reporter_role?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lot_reports_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "lot_reports_lot_id_fkey"
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
          buy_now_price: number | null
          category_id: string | null
          condition: Database["public"]["Enums"]["lot_condition"]
          created_at: string
          current_bid: number | null
          description: string | null
          event_id: string
          fixed_price: number | null
          id: string
          is_featured: boolean | null
          min_bid_increment: number | null
          pricing_type: Database["public"]["Enums"]["pricing_type"]
          prohibited_materials_confirmed: boolean | null
          quantity: number
          reserve_met: boolean | null
          reserve_price: number | null
          reserved_order_id: string | null
          reserved_until: string | null
          retail_estimate: number | null
          start_price: number | null
          status: Database["public"]["Enums"]["lot_status"]
          title: string
          unit: string | null
          updated_at: string
          view_count: number | null
          winning_bidder_id: string | null
        }
        Insert: {
          auction_end?: string | null
          bid_count?: number | null
          buy_now_price?: number | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["lot_condition"]
          created_at?: string
          current_bid?: number | null
          description?: string | null
          event_id: string
          fixed_price?: number | null
          id?: string
          is_featured?: boolean | null
          min_bid_increment?: number | null
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          prohibited_materials_confirmed?: boolean | null
          quantity?: number
          reserve_met?: boolean | null
          reserve_price?: number | null
          reserved_order_id?: string | null
          reserved_until?: string | null
          retail_estimate?: number | null
          start_price?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          title: string
          unit?: string | null
          updated_at?: string
          view_count?: number | null
          winning_bidder_id?: string | null
        }
        Update: {
          auction_end?: string | null
          bid_count?: number | null
          buy_now_price?: number | null
          category_id?: string | null
          condition?: Database["public"]["Enums"]["lot_condition"]
          created_at?: string
          current_bid?: number | null
          description?: string | null
          event_id?: string
          fixed_price?: number | null
          id?: string
          is_featured?: boolean | null
          min_bid_increment?: number | null
          pricing_type?: Database["public"]["Enums"]["pricing_type"]
          prohibited_materials_confirmed?: boolean | null
          quantity?: number
          reserve_met?: boolean | null
          reserve_price?: number | null
          reserved_order_id?: string | null
          reserved_until?: string | null
          retail_estimate?: number | null
          start_price?: number | null
          status?: Database["public"]["Enums"]["lot_status"]
          title?: string
          unit?: string | null
          updated_at?: string
          view_count?: number | null
          winning_bidder_id?: string | null
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
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_system: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          email_sent_at: string | null
          email_should_send: boolean
          id: string
          link_url: string | null
          message: string | null
          priority: string
          read: boolean | null
          read_at: string | null
          related_conversation_id: string | null
          related_lot_id: string | null
          related_order_id: string | null
          related_report_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          email_sent_at?: string | null
          email_should_send?: boolean
          id?: string
          link_url?: string | null
          message?: string | null
          priority?: string
          read?: boolean | null
          read_at?: string | null
          related_conversation_id?: string | null
          related_lot_id?: string | null
          related_order_id?: string | null
          related_report_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          email_sent_at?: string | null
          email_should_send?: boolean
          id?: string
          link_url?: string | null
          message?: string | null
          priority?: string
          read?: boolean | null
          read_at?: string | null
          related_conversation_id?: string | null
          related_lot_id?: string | null
          related_order_id?: string | null
          related_report_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_conversation_id_fkey"
            columns: ["related_conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_lot_id_fkey"
            columns: ["related_lot_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "notifications_related_lot_id_fkey"
            columns: ["related_lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "notifications_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_report_id_fkey"
            columns: ["related_report_id"]
            isOneToOne: false
            referencedRelation: "lot_reports"
            referencedColumns: ["id"]
          },
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
          admin_notes: string | null
          agreed_pickup_at: string | null
          amount: number
          buyer_collected_at: string | null
          buyer_id: string
          buyer_org_id: string
          created_at: string
          event_id: string
          id: string
          lot_id: string
          notes: string | null
          payment_reference: string | null
          pickup_code: string | null
          pickup_slot_id: string | null
          pickup_status: string
          proposed_pickup_at: string | null
          proposed_pickup_by: string | null
          seller_confirmed_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          agreed_pickup_at?: string | null
          amount: number
          buyer_collected_at?: string | null
          buyer_id: string
          buyer_org_id: string
          created_at?: string
          event_id: string
          id?: string
          lot_id: string
          notes?: string | null
          payment_reference?: string | null
          pickup_code?: string | null
          pickup_slot_id?: string | null
          pickup_status?: string
          proposed_pickup_at?: string | null
          proposed_pickup_by?: string | null
          seller_confirmed_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          agreed_pickup_at?: string | null
          amount?: number
          buyer_collected_at?: string | null
          buyer_id?: string
          buyer_org_id?: string
          created_at?: string
          event_id?: string
          id?: string
          lot_id?: string
          notes?: string | null
          payment_reference?: string | null
          pickup_code?: string | null
          pickup_slot_id?: string | null
          pickup_status?: string
          proposed_pickup_at?: string | null
          proposed_pickup_by?: string | null
          seller_confirmed_at?: string | null
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
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
          bio: string | null
          created_at: string
          email: string | null
          id: string
          is_approved: boolean | null
          is_disabled: boolean | null
          is_founding: boolean | null
          is_verified: boolean | null
          logo_url: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone: string | null
          postcode: string | null
          rating_avg: number | null
          rating_count: number | null
          state: string | null
          suburb: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          abn?: string | null
          address?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_disabled?: boolean | null
          is_founding?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          name: string
          org_type: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          postcode?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          abn?: string | null
          address?: string | null
          bio?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_disabled?: boolean | null
          is_founding?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string
          org_type?: Database["public"]["Enums"]["org_type"]
          phone?: string | null
          postcode?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          state?: string | null
          suburb?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_notes: string | null
          amount_charged: number
          application_fee_amount: number | null
          base_amount: number
          buyer_fee: number
          created_at: string
          environment: string
          error_message: string | null
          id: string
          manual_payout_paid_at: string | null
          manual_payout_reference: string | null
          manual_payout_status: Database["public"]["Enums"]["manual_payout_status"]
          order_id: string
          payment_method: string | null
          payment_mode: Database["public"]["Enums"]["payment_mode"]
          seller_fee: number
          seller_payout: number
          status: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount_charged: number
          application_fee_amount?: number | null
          base_amount: number
          buyer_fee?: number
          created_at?: string
          environment?: string
          error_message?: string | null
          id?: string
          manual_payout_paid_at?: string | null
          manual_payout_reference?: string | null
          manual_payout_status?: Database["public"]["Enums"]["manual_payout_status"]
          order_id: string
          payment_method?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          seller_fee?: number
          seller_payout?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount_charged?: number
          application_fee_amount?: number | null
          base_amount?: number
          buyer_fee?: number
          created_at?: string
          environment?: string
          error_message?: string | null
          id?: string
          manual_payout_paid_at?: string | null
          manual_payout_reference?: string | null
          manual_payout_status?: Database["public"]["Enums"]["manual_payout_status"]
          order_id?: string
          payment_method?: string | null
          payment_mode?: Database["public"]["Enums"]["payment_mode"]
          seller_fee?: number
          seller_payout?: number
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["order_id"]
          },
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["order_id"]
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
          bio: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewee_org_id: string | null
          reviewer_id: string
          reviewer_role: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          reviewee_id: string
          reviewee_org_id?: string | null
          reviewer_id: string
          reviewer_role: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          reviewee_id?: string
          reviewee_org_id?: string | null
          reviewer_id?: string
          reviewer_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_org_id_fkey"
            columns: ["reviewee_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_search_alerts: {
        Row: {
          id: string
          lot_id: string
          read_at: string | null
          saved_search_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          lot_id: string
          read_at?: string | null
          saved_search_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          lot_id?: string
          read_at?: string | null
          saved_search_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_search_alerts_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
          {
            foreignKeyName: "saved_search_alerts_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_search_alerts_saved_search_id_fkey"
            columns: ["saved_search_id"]
            isOneToOne: false
            referencedRelation: "saved_searches"
            referencedColumns: ["id"]
          },
        ]
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
      seller_badges: {
        Row: {
          badge: string
          granted_at: string
          granted_by: string | null
          id: string
          org_id: string
        }
        Insert: {
          badge: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id: string
        }
        Update: {
          badge?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_badges_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_stripe_accounts: {
        Row: {
          account_status: string | null
          charges_enabled: boolean | null
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
          account_status?: string | null
          charges_enabled?: boolean | null
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
          account_status?: string | null
          charges_enabled?: boolean | null
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
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
      admin_stuck_orders: {
        Row: {
          agreed_pickup_at: string | null
          amount: number | null
          created_at: string | null
          has_conversation: boolean | null
          has_open_issue: boolean | null
          lot_id: string | null
          lot_status: Database["public"]["Enums"]["lot_status"] | null
          lot_title: string | null
          manual_payout_status:
            | Database["public"]["Enums"]["manual_payout_status"]
            | null
          order_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          pickup_code: string | null
          pickup_status: string | null
          proposed_pickup_at: string | null
          status: Database["public"]["Enums"]["order_status"] | null
          stuck_reason: string | null
          updated_at: string | null
        }
        Relationships: []
      }
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
            referencedRelation: "admin_stuck_orders"
            referencedColumns: ["lot_id"]
          },
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
      admin_add_order_note: {
        Args: { _note: string; _order_id: string }
        Returns: undefined
      }
      admin_cancel_order: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
      admin_force_complete_order: {
        Args: { _note?: string; _order_id: string }
        Returns: undefined
      }
      admin_regenerate_pickup_code: {
        Args: { _note?: string; _order_id: string }
        Returns: string
      }
      admin_resolve_report: {
        Args: { _note?: string; _report_id: string; _status: string }
        Returns: undefined
      }
      admin_set_org_disabled: {
        Args: { _disabled: boolean; _org_id: string }
        Returns: undefined
      }
      admin_set_org_founding: {
        Args: { _founding: boolean; _org_id: string }
        Returns: undefined
      }
      admin_set_org_verified: {
        Args: { _org_id: string; _verified: boolean }
        Returns: undefined
      }
      admin_set_payout_status: {
        Args: {
          _note?: string
          _payment_id: string
          _reference?: string
          _status: string
        }
        Returns: undefined
      }
      close_all_expired_auctions: {
        Args: never
        Returns: {
          lot_id: string
          result: string
        }[]
      }
      close_expired_auction: { Args: { _lot_id: string }; Returns: string }
      generate_pickup_code: { Args: never; Returns: string }
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
      is_conversation_participant: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      notify_admins: {
        Args: {
          _link_url?: string
          _lot_id?: string
          _message: string
          _order_id?: string
          _priority?: string
          _report_id?: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_org: {
        Args: {
          _conversation_id?: string
          _link_url?: string
          _lot_id?: string
          _message: string
          _order_id?: string
          _org_id: string
          _priority?: string
          _title: string
          _type: string
        }
        Returns: undefined
      }
      notify_user: {
        Args: {
          _conversation_id?: string
          _email?: boolean
          _link_url?: string
          _lot_id?: string
          _message: string
          _order_id?: string
          _priority?: string
          _report_id?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
      release_expired_reservations: { Args: never; Returns: number }
      release_lot_reservation: { Args: { _lot_id: string }; Returns: undefined }
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
      lot_status:
        | "draft"
        | "active"
        | "sold"
        | "unsold"
        | "cancelled"
        | "reserved"
        | "expired"
      manual_payout_status:
        | "manual_payout_pending"
        | "manual_payout_paid"
        | "manual_payout_failed"
        | "manual_payout_on_hold"
      order_status:
        | "pending_payment"
        | "paid"
        | "ready_for_pickup"
        | "collected"
        | "cancelled"
        | "disputed"
      org_type: "seller" | "buyer" | "fabricator"
      payment_mode: "manual_payout_mode" | "stripe_connect_mode"
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
      lot_status: [
        "draft",
        "active",
        "sold",
        "unsold",
        "cancelled",
        "reserved",
        "expired",
      ],
      manual_payout_status: [
        "manual_payout_pending",
        "manual_payout_paid",
        "manual_payout_failed",
        "manual_payout_on_hold",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "ready_for_pickup",
        "collected",
        "cancelled",
        "disputed",
      ],
      org_type: ["seller", "buyer", "fabricator"],
      payment_mode: ["manual_payout_mode", "stripe_connect_mode"],
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
