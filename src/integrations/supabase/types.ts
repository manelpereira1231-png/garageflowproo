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
      admin_campaign_recipients: {
        Row: {
          campaign_id: string
          created_at: string
          email: string
          error_message: string | null
          id: string
          opened_at: string | null
          segment: string | null
          sent_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          email: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          email?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          segment?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "admin_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_campaigns: {
        Row: {
          audience: string
          content_html: string
          country_filter: string | null
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          name: string
          opened_count: number
          recipients_count: number
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          audience?: string
          content_html: string
          country_filter?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name: string
          opened_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          audience?: string
          content_html?: string
          country_filter?: string | null
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          name?: string
          opened_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_coupon_redemptions: {
        Row: {
          applied_at: string
          coupon_id: string
          details: Json | null
          id: string
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          applied_at?: string
          coupon_id: string
          details?: Json | null
          id?: string
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          applied_at?: string
          coupon_id?: string
          details?: Json | null
          id?: string
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_coupon_redemptions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "admin_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_coupons: {
        Row: {
          active: boolean
          applies_to_plan: string
          code: string
          created_at: string
          created_by: string | null
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          max_redemptions: number | null
          redemptions_count: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          applies_to_plan?: string
          code: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemptions_count?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          applies_to_plan?: string
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          max_redemptions?: number | null
          redemptions_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          client_id: string | null
          created_at: string
          due_date: string | null
          follow_up_count: number
          id: string
          last_follow_up_at: string | null
          message: string
          next_follow_up_at: string | null
          priority: string
          shop_id: string
          status: string
          title: string
          type: string
          vehicle_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          message: string
          next_follow_up_at?: string | null
          priority?: string
          shop_id: string
          status?: string
          title: string
          type: string
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          due_date?: string | null
          follow_up_count?: number
          id?: string
          last_follow_up_at?: string | null
          message?: string
          next_follow_up_at?: string | null
          priority?: string
          shop_id?: string
          status?: string
          title?: string
          type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          rate_limit: number
          request_count: number
          scopes: string[]
          shop_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number
          request_count?: number
          scopes?: string[]
          shop_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          rate_limit?: number
          request_count?: number
          scopes?: string[]
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          notes: string | null
          service_type: string
          shop_id: string
          status: string
          time: string
          vehicle_id: string | null
        }
        Insert: {
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          service_type?: string
          shop_id: string
          status?: string
          time: string
          vehicle_id?: string | null
        }
        Update: {
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          service_type?: string
          shop_id?: string
          status?: string
          time?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_risk_flags: {
        Row: {
          auto_resolved: boolean
          created_at: string
          description: string
          details: Json | null
          entity_id: string
          entity_type: string
          flag_type: string
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
        }
        Insert: {
          auto_resolved?: boolean
          created_at?: string
          description: string
          details?: Json | null
          entity_id: string
          entity_type: string
          flag_type: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
        }
        Update: {
          auto_resolved?: boolean
          created_at?: string
          description?: string
          details?: Json | null
          entity_id?: string
          entity_type?: string
          flag_type?: string
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
        }
        Relationships: []
      }
      automation_logs: {
        Row: {
          action_type: string
          created_at: string
          details: Json | null
          id: string
          rule_id: string | null
          shop_id: string
          status: string
          trigger_type: string
        }
        Insert: {
          action_type: string
          created_at?: string
          details?: Json | null
          id?: string
          rule_id?: string | null
          shop_id: string
          status?: string
          trigger_type: string
        }
        Update: {
          action_type?: string
          created_at?: string
          details?: Json | null
          id?: string
          rule_id?: string | null
          shop_id?: string
          status?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          active: boolean
          conditions: Json
          created_at: string
          id: string
          last_run_at: string | null
          name: string
          run_count: number
          shop_id: string
          trigger_type: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          active?: boolean
          conditions?: Json
          created_at?: string
          id?: string
          last_run_at?: string | null
          name: string
          run_count?: number
          shop_id: string
          trigger_type?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          active?: boolean
          conditions?: Json
          created_at?: string
          id?: string
          last_run_at?: string | null
          name?: string
          run_count?: number
          shop_id?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          content: string | null
          created_at: string
          id: string
          name: string
          opened_count: number
          recipients_count: number
          scheduled_at: string | null
          sent_at: string | null
          shop_id: string
          status: string
          subject: string | null
          target_segment: string
          type: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          name: string
          opened_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          shop_id: string
          status?: string
          subject?: string | null
          target_segment?: string
          type?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          name?: string
          opened_count?: number
          recipients_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          shop_id?: string
          status?: string
          subject?: string | null
          target_segment?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_boosts: {
        Row: {
          boost_type: string
          created_at: string
          expires_at: string | null
          id: string
          listing_id: string
          price: number
          seller_id: string
          started_at: string | null
          status: string
          stripe_session_id: string | null
          stripe_verified: boolean
        }
        Insert: {
          boost_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id: string
          price?: number
          seller_id: string
          started_at?: string | null
          status?: string
          stripe_session_id?: string | null
          stripe_verified?: boolean
        }
        Update: {
          boost_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id?: string
          price?: number
          seller_id?: string
          started_at?: string | null
          status?: string
          stripe_session_id?: string | null
          stripe_verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carity_boosts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_chat_messages: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string
          message_type: string
          offer_amount: number | null
          read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message?: string
          message_type?: string
          offer_amount?: number | null
          read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          message_type?: string
          offer_amount?: number | null
          read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "carity_chat_messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_inspection_offers: {
        Row: {
          id: string
          inspection_id: string
          listing_id: string
          offered_at: string
          rejection_reason: string | null
          responded_at: string | null
          shop_id: string
          status: string
        }
        Insert: {
          id?: string
          inspection_id: string
          listing_id: string
          offered_at?: string
          rejection_reason?: string | null
          responded_at?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          id?: string
          inspection_id?: string
          listing_id?: string
          offered_at?: string
          rejection_reason?: string | null
          responded_at?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "carity_inspection_offers_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "carity_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_inspection_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_inspection_offers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_inspection_reports: {
        Row: {
          brakes_status: string
          completed_at: string | null
          created_at: string
          damage_photos: Json
          defects: Json
          electrical_status: string
          engine_photos: Json
          engine_status: string
          exterior_photos: Json
          id: string
          inspection_id: string
          inspector_notes: string | null
          interior_photos: Json
          is_locked: boolean
          listing_id: string
          locked_at: string | null
          overall_score: number
          recommendation: string
          report_hash: string | null
          shop_id: string
          steering_status: string
          submitted_by_user_id: string | null
          suspension_status: string
          technician_name: string | null
          tire_photos: Json
          tires_status: string
          transmission_status: string
        }
        Insert: {
          brakes_status?: string
          completed_at?: string | null
          created_at?: string
          damage_photos?: Json
          defects?: Json
          electrical_status?: string
          engine_photos?: Json
          engine_status?: string
          exterior_photos?: Json
          id?: string
          inspection_id: string
          inspector_notes?: string | null
          interior_photos?: Json
          is_locked?: boolean
          listing_id: string
          locked_at?: string | null
          overall_score?: number
          recommendation?: string
          report_hash?: string | null
          shop_id: string
          steering_status?: string
          submitted_by_user_id?: string | null
          suspension_status?: string
          technician_name?: string | null
          tire_photos?: Json
          tires_status?: string
          transmission_status?: string
        }
        Update: {
          brakes_status?: string
          completed_at?: string | null
          created_at?: string
          damage_photos?: Json
          defects?: Json
          electrical_status?: string
          engine_photos?: Json
          engine_status?: string
          exterior_photos?: Json
          id?: string
          inspection_id?: string
          inspector_notes?: string | null
          interior_photos?: Json
          is_locked?: boolean
          listing_id?: string
          locked_at?: string | null
          overall_score?: number
          recommendation?: string
          report_hash?: string | null
          shop_id?: string
          steering_status?: string
          submitted_by_user_id?: string | null
          suspension_status?: string
          technician_name?: string | null
          tire_photos?: Json
          tires_status?: string
          transmission_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "carity_inspection_reports_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "carity_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_inspection_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_inspection_reports_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_inspections: {
        Row: {
          assigned_at: string
          completed_at: string | null
          id: string
          listing_id: string
          notes: string | null
          payment_amount: number
          payment_status: string
          platform_share: number
          scheduled_date: string | null
          scheduled_time: string | null
          seller_contacted_at: string | null
          seller_notified: boolean
          shop_id: string
          shop_share: number
          started_at: string | null
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          payment_amount?: number
          payment_status?: string
          platform_share?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          seller_contacted_at?: string | null
          seller_notified?: boolean
          shop_id: string
          shop_share?: number
          started_at?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          payment_amount?: number
          payment_status?: string
          platform_share?: number
          scheduled_date?: string | null
          scheduled_time?: string | null
          seller_contacted_at?: string | null
          seller_notified?: boolean
          shop_id?: string
          shop_share?: number
          started_at?: string | null
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carity_inspections_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_inspections_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_listings: {
        Row: {
          boost_active: boolean
          boost_expires_at: string | null
          commission_rate: number
          created_at: string
          description: string
          fuel: string
          id: string
          location_label: string | null
          location_lat: number | null
          location_lng: number | null
          make: string
          mileage: number
          model: string
          photos: Json
          plate: string
          price: number
          published_at: string | null
          requires_independent_inspection: boolean
          seller_id: string
          shop_id: string | null
          sold_at: string | null
          status: string
          vin: string | null
          year: number
        }
        Insert: {
          boost_active?: boolean
          boost_expires_at?: string | null
          commission_rate?: number
          created_at?: string
          description?: string
          fuel?: string
          id?: string
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string
          mileage?: number
          model?: string
          photos?: Json
          plate?: string
          price?: number
          published_at?: string | null
          requires_independent_inspection?: boolean
          seller_id: string
          shop_id?: string | null
          sold_at?: string | null
          status?: string
          vin?: string | null
          year?: number
        }
        Update: {
          boost_active?: boolean
          boost_expires_at?: string | null
          commission_rate?: number
          created_at?: string
          description?: string
          fuel?: string
          id?: string
          location_label?: string | null
          location_lat?: number | null
          location_lng?: number | null
          make?: string
          mileage?: number
          model?: string
          photos?: Json
          plate?: string
          price?: number
          published_at?: string | null
          requires_independent_inspection?: boolean
          seller_id?: string
          shop_id?: string | null
          sold_at?: string | null
          status?: string
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "carity_listings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_offers: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          expires_at: string | null
          id: string
          listing_id: string
          message: string | null
          responded_at: string | null
          seller_id: string
          status: string
          stripe_session_id: string | null
        }
        Insert: {
          amount?: number
          buyer_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id: string
          message?: string | null
          responded_at?: string | null
          seller_id: string
          status?: string
          stripe_session_id?: string | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          listing_id?: string
          message?: string | null
          responded_at?: string | null
          seller_id?: string
          status?: string
          stripe_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carity_offers_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_seller_profiles: {
        Row: {
          account_type: string
          address: string | null
          country_code: string
          created_at: string
          dealer_active_until: string | null
          dealer_city: string | null
          dealer_company_name: string | null
          dealer_description: string | null
          dealer_license: string | null
          dealer_logo_url: string | null
          dealer_nif: string | null
          dealer_plan: string
          dealer_slug: string | null
          dealer_stripe_customer_id: string | null
          dealer_stripe_price_id: string | null
          dealer_stripe_subscription_id: string | null
          dealer_subscription_status: string | null
          document_number: string | null
          document_type: string | null
          document_url: string | null
          id: string
          kyc_rejection_reason: string | null
          kyc_reviewed_at: string | null
          kyc_status: string
          kyc_submitted_at: string | null
          location: string
          name: string
          nif: string | null
          phone: string
          selfie_url: string | null
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_onboarded: boolean
          stripe_connect_payouts_enabled: boolean
          suspended_at: string | null
          suspension_reason: string | null
          user_id: string
          verified: boolean
        }
        Insert: {
          account_type?: string
          address?: string | null
          country_code?: string
          created_at?: string
          dealer_active_until?: string | null
          dealer_city?: string | null
          dealer_company_name?: string | null
          dealer_description?: string | null
          dealer_license?: string | null
          dealer_logo_url?: string | null
          dealer_nif?: string | null
          dealer_plan?: string
          dealer_slug?: string | null
          dealer_stripe_customer_id?: string | null
          dealer_stripe_price_id?: string | null
          dealer_stripe_subscription_id?: string | null
          dealer_subscription_status?: string | null
          document_number?: string | null
          document_type?: string | null
          document_url?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string
          name?: string
          nif?: string | null
          phone?: string
          selfie_url?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id: string
          verified?: boolean
        }
        Update: {
          account_type?: string
          address?: string | null
          country_code?: string
          created_at?: string
          dealer_active_until?: string | null
          dealer_city?: string | null
          dealer_company_name?: string | null
          dealer_description?: string | null
          dealer_license?: string | null
          dealer_logo_url?: string | null
          dealer_nif?: string | null
          dealer_plan?: string
          dealer_slug?: string | null
          dealer_stripe_customer_id?: string | null
          dealer_stripe_price_id?: string | null
          dealer_stripe_subscription_id?: string | null
          dealer_subscription_status?: string | null
          document_number?: string | null
          document_type?: string | null
          document_url?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_reviewed_at?: string | null
          kyc_status?: string
          kyc_submitted_at?: string | null
          location?: string
          name?: string
          nif?: string | null
          phone?: string
          selfie_url?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          suspended_at?: string | null
          suspension_reason?: string | null
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
        ]
      }
      carity_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          inspection_id: string | null
          listing_id: string | null
          platform_amount: number
          shop_amount: number
          shop_id: string | null
          status: string
          stripe_payment_id: string | null
          stripe_verified: boolean
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          inspection_id?: string | null
          listing_id?: string | null
          platform_amount?: number
          shop_amount?: number
          shop_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          stripe_verified?: boolean
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          inspection_id?: string | null
          listing_id?: string | null
          platform_amount?: number
          shop_amount?: number
          shop_id?: string | null
          status?: string
          stripe_payment_id?: string | null
          stripe_verified?: boolean
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "carity_transactions_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "carity_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_transactions_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carity_transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          message: string
          read: boolean
          sender_id: string | null
          sender_type: string
          shop_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          message: string
          read?: boolean
          sender_id?: string | null
          sender_type?: string
          shop_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sender_id?: string | null
          sender_type?: string
          shop_id?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          company: string | null
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          name: string
          nif: string | null
          notes: string | null
          phone: string
          portal_token: string | null
          shop_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          name: string
          nif?: string | null
          notes?: string | null
          phone?: string
          portal_token?: string | null
          shop_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          name?: string
          nif?: string | null
          notes?: string | null
          phone?: string
          portal_token?: string | null
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      country_settings: {
        Row: {
          active: boolean
          code: string
          created_at: string
          currency: string
          currency_symbol: string
          default_language: string
          flag_emoji: string
          inspection_platform_share: number
          inspection_price: number
          inspection_shop_share: number
          launch_date: string | null
          locale: string
          market_commission_rate: number
          name: string
          notes: string | null
          saas_garage_monthly: number
          saas_garage_yearly: number
          saas_pro_monthly: number
          saas_pro_yearly: number
          saas_trial_days: number
          stripe_garage_monthly: string | null
          stripe_garage_yearly: string | null
          stripe_pro_monthly: string | null
          stripe_pro_yearly: string | null
          supported_languages: string[]
          tax_label: string
          timezones: string[]
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          currency: string
          currency_symbol: string
          default_language?: string
          flag_emoji?: string
          inspection_platform_share?: number
          inspection_price?: number
          inspection_shop_share?: number
          launch_date?: string | null
          locale: string
          market_commission_rate?: number
          name: string
          notes?: string | null
          saas_garage_monthly?: number
          saas_garage_yearly?: number
          saas_pro_monthly?: number
          saas_pro_yearly?: number
          saas_trial_days?: number
          stripe_garage_monthly?: string | null
          stripe_garage_yearly?: string | null
          stripe_pro_monthly?: string | null
          stripe_pro_yearly?: string | null
          supported_languages?: string[]
          tax_label?: string
          timezones?: string[]
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          currency?: string
          currency_symbol?: string
          default_language?: string
          flag_emoji?: string
          inspection_platform_share?: number
          inspection_price?: number
          inspection_shop_share?: number
          launch_date?: string | null
          locale?: string
          market_commission_rate?: number
          name?: string
          notes?: string | null
          saas_garage_monthly?: number
          saas_garage_yearly?: number
          saas_pro_monthly?: number
          saas_pro_yearly?: number
          saas_trial_days?: number
          stripe_garage_monthly?: string | null
          stripe_garage_yearly?: string | null
          stripe_pro_monthly?: string | null
          stripe_pro_yearly?: string | null
          supported_languages?: string[]
          tax_label?: string
          timezones?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          id: string
          shop_id: string
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          shop_id: string
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          id?: string
          shop_id?: string
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: []
      }
      inspection_checklists: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          items: Json
          shop_id: string
          technician: string | null
          work_order_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          shop_id: string
          technician?: string | null
          work_order_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          shop_id?: string
          technician?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklists_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          description: string
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          created_at: string
          currency: string
          due_date: string | null
          id: string
          notes: string | null
          number: string
          quote_id: string | null
          shop_id: string
          status: string
          subtotal: number
          total: number
          type: string
          vat_total: number
          vehicle_id: string | null
          work_order_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          number: string
          quote_id?: string | null
          shop_id: string
          status?: string
          subtotal?: number
          total?: number
          type?: string
          vat_total?: number
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          number?: string
          quote_id?: string | null
          shop_id?: string
          status?: string
          subtotal?: number
          total?: number
          type?: string
          vat_total?: number
          vehicle_id?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_visits: {
        Row: {
          campaign: string | null
          country_hint: string | null
          created_at: string
          device_type: string | null
          gclid: string | null
          id: string
          landing_path: string | null
          medium: string | null
          referrer: string | null
          session_id: string | null
          source: string | null
        }
        Insert: {
          campaign?: string | null
          country_hint?: string | null
          created_at?: string
          device_type?: string | null
          gclid?: string | null
          id?: string
          landing_path?: string | null
          medium?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
        }
        Update: {
          campaign?: string | null
          country_hint?: string | null
          created_at?: string
          device_type?: string | null
          gclid?: string | null
          id?: string
          landing_path?: string | null
          medium?: string | null
          referrer?: string | null
          session_id?: string | null
          source?: string | null
        }
        Relationships: []
      }
      listing_alerts: {
        Row: {
          active: boolean
          created_at: string
          email: string
          fuel: string | null
          id: string
          last_sent_at: string | null
          make: string | null
          max_mileage: number | null
          max_price: number | null
          min_year: number | null
          model: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email: string
          fuel?: string | null
          id?: string
          last_sent_at?: string | null
          make?: string | null
          max_mileage?: number | null
          max_price?: number | null
          min_year?: number | null
          model?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          fuel?: string | null
          id?: string
          last_sent_at?: string | null
          make?: string | null
          max_mileage?: number | null
          max_price?: number | null
          min_year?: number | null
          model?: string | null
          user_id?: string
        }
        Relationships: []
      }
      listing_favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          session_id: string | null
          user_id: string | null
          viewed_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          session_id?: string | null
          user_id?: string | null
          viewed_date?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          session_id?: string | null
          user_id?: string | null
          viewed_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          client_id: string
          created_at: string
          id: string
          points: number
          shop_id: string
          tier: string
          total_earned: number
          total_redeemed: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          points?: number
          shop_id: string
          tier?: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          points?: number
          shop_id?: string
          tier?: string
          total_earned?: number
          total_redeemed?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_rewards: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          points_cost: number
          reward_type: string
          reward_value: number
          shop_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          points_cost?: number
          reward_type?: string
          reward_value?: number
          shop_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          points_cost?: number
          reward_type?: string
          reward_value?: number
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_rewards_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          points: number
          reference_id: string | null
          shop_id: string
          type: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          points: number
          reference_id?: string | null
          shop_id: string
          type?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          points?: number
          reference_id?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      market_contracts: {
        Row: {
          amount: number
          buyer_id: string
          buyer_signature_url: string | null
          buyer_signed_at: string | null
          buyer_snapshot: Json
          contract_hash: string | null
          contract_number: string
          created_at: string
          escrow_id: string
          id: string
          listing_id: string
          seller_id: string
          seller_signature_url: string | null
          seller_signed_at: string | null
          seller_snapshot: Json
          signed_status: string
          vehicle_snapshot: Json
        }
        Insert: {
          amount?: number
          buyer_id: string
          buyer_signature_url?: string | null
          buyer_signed_at?: string | null
          buyer_snapshot?: Json
          contract_hash?: string | null
          contract_number: string
          created_at?: string
          escrow_id: string
          id?: string
          listing_id: string
          seller_id: string
          seller_signature_url?: string | null
          seller_signed_at?: string | null
          seller_snapshot?: Json
          signed_status?: string
          vehicle_snapshot?: Json
        }
        Update: {
          amount?: number
          buyer_id?: string
          buyer_signature_url?: string | null
          buyer_signed_at?: string | null
          buyer_snapshot?: Json
          contract_hash?: string | null
          contract_number?: string
          created_at?: string
          escrow_id?: string
          id?: string
          listing_id?: string
          seller_id?: string
          seller_signature_url?: string | null
          seller_signed_at?: string | null
          seller_snapshot?: Json
          signed_status?: string
          vehicle_snapshot?: Json
        }
        Relationships: []
      }
      market_escrow: {
        Row: {
          amount: number
          application_fee_amount: number
          buyer_dispute_reason: string | null
          buyer_id: string
          cancelled_within_window: boolean
          capture_method: string
          captured_at: string | null
          commission_rate: number
          created_at: string
          delivery_confirmed_at: string | null
          delivery_deadline: string | null
          disputed_at: string | null
          id: string
          listing_id: string
          platform_fee: number
          refunded_at: string | null
          released_at: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          satisfaction_window_ends_at: string | null
          seller_amount: number
          seller_dispute_response: string | null
          seller_id: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          stripe_verified: boolean
          transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          application_fee_amount?: number
          buyer_dispute_reason?: string | null
          buyer_id: string
          cancelled_within_window?: boolean
          capture_method?: string
          captured_at?: string | null
          commission_rate?: number
          created_at?: string
          delivery_confirmed_at?: string | null
          delivery_deadline?: string | null
          disputed_at?: string | null
          id?: string
          listing_id: string
          platform_fee?: number
          refunded_at?: string | null
          released_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          satisfaction_window_ends_at?: string | null
          seller_amount?: number
          seller_dispute_response?: string | null
          seller_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_verified?: boolean
          transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          application_fee_amount?: number
          buyer_dispute_reason?: string | null
          buyer_id?: string
          cancelled_within_window?: boolean
          capture_method?: string
          captured_at?: string | null
          commission_rate?: number
          created_at?: string
          delivery_confirmed_at?: string | null
          delivery_deadline?: string | null
          disputed_at?: string | null
          id?: string
          listing_id?: string
          platform_fee?: number
          refunded_at?: string | null
          released_at?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          satisfaction_window_ends_at?: string | null
          seller_amount?: number
          seller_dispute_response?: string | null
          seller_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          stripe_verified?: boolean
          transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_escrow_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          shop_id: string
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          shop_id: string
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          shop_id?: string
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commissions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          partner_id: string
          period_end: string | null
          period_start: string | null
          referral_id: string | null
          shop_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          period_end?: string | null
          period_start?: string | null
          referral_id?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          period_end?: string | null
          period_start?: string | null
          referral_id?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "partner_referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          discount_percent: number
          id: string
          invite_token: string
          last_reminder_at: string | null
          partner_id: string
          plan_offer: string
          reminder_count: number
          sent_at: string | null
          shop_id: string | null
          status: string
          trial_days: number
          workshop_email: string
          workshop_name: string
          workshop_phone: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          invite_token?: string
          last_reminder_at?: string | null
          partner_id: string
          plan_offer?: string
          reminder_count?: number
          sent_at?: string | null
          shop_id?: string | null
          status?: string
          trial_days?: number
          workshop_email: string
          workshop_name?: string
          workshop_phone?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          invite_token?: string
          last_reminder_at?: string | null
          partner_id?: string
          plan_offer?: string
          reminder_count?: number
          sent_at?: string | null
          shop_id?: string | null
          status?: string
          trial_days?: number
          workshop_email?: string
          workshop_name?: string
          workshop_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_invites_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          partner_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          partner_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          partner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_logs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_payouts: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          partner_id: string
          status: string
          stripe_transfer_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          partner_id: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          partner_id?: string
          status?: string
          stripe_transfer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_payouts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_referrals: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          partner_id: string
          shop_id: string
          subscription_id: string | null
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          partner_id: string
          shop_id: string
          subscription_id?: string | null
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          partner_id?: string
          shop_id?: string
          subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_referrals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_referrals_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          api_key: string | null
          auth_user_id: string | null
          commission_percentage: number
          contact_email: string
          contact_phone: string
          country_code: string
          created_at: string
          discount_percentage: number
          id: string
          name: string
          payout_bank: string | null
          payout_holder_name: string | null
          payout_iban: string | null
          payout_mbway_phone: string | null
          payout_method: string
          status: string
          stripe_account_id: string | null
          type: string
        }
        Insert: {
          api_key?: string | null
          auth_user_id?: string | null
          commission_percentage?: number
          contact_email?: string
          contact_phone?: string
          country_code?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          name: string
          payout_bank?: string | null
          payout_holder_name?: string | null
          payout_iban?: string | null
          payout_mbway_phone?: string | null
          payout_method?: string
          status?: string
          stripe_account_id?: string | null
          type?: string
        }
        Update: {
          api_key?: string | null
          auth_user_id?: string | null
          commission_percentage?: number
          contact_email?: string
          contact_phone?: string
          country_code?: string
          created_at?: string
          discount_percentage?: number
          id?: string
          name?: string
          payout_bank?: string | null
          payout_holder_name?: string | null
          payout_iban?: string | null
          payout_mbway_phone?: string | null
          payout_method?: string
          status?: string
          stripe_account_id?: string | null
          type?: string
        }
        Relationships: []
      }
      parts: {
        Row: {
          active: boolean
          created_at: string
          id: string
          internal_cost: number
          min_stock: number
          name: string
          reference: string | null
          sale_price: number
          shop_id: string
          stock_quantity: number
          supplier: string | null
          vat_rate: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          internal_cost?: number
          min_stock?: number
          name: string
          reference?: string | null
          sale_price?: number
          shop_id: string
          stock_quantity?: number
          supplier?: string | null
          vat_rate?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          internal_cost?: number
          min_stock?: number
          name?: string
          reference?: string | null
          sale_price?: number
          shop_id?: string
          stock_quantity?: number
          supplier?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "parts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_order_items: {
        Row: {
          id: string
          order_id: string
          part_name: string
          part_number: string
          quantity: number
          supplier_part_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          order_id: string
          part_name: string
          part_number?: string
          quantity?: number
          supplier_part_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          order_id?: string
          part_name?: string
          part_number?: string
          quantity?: number
          supplier_part_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "parts_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "parts_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_order_items_supplier_part_id_fkey"
            columns: ["supplier_part_id"]
            isOneToOne: false
            referencedRelation: "supplier_parts"
            referencedColumns: ["id"]
          },
        ]
      }
      parts_orders: {
        Row: {
          created_at: string
          delivered_at: string | null
          id: string
          notes: string | null
          part_name: string
          part_reference: string | null
          quantity: number
          shop_id: string
          status: string
          supplier_id: string | null
          total: number
          unit_price: number
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          part_name: string
          part_reference?: string | null
          quantity?: number
          shop_id: string
          status?: string
          supplier_id?: string | null
          total?: number
          unit_price?: number
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          id?: string
          notes?: string | null
          part_name?: string
          part_reference?: string | null
          quantity?: number
          shop_id?: string
          status?: string
          supplier_id?: string | null
          total?: number
          unit_price?: number
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parts_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parts_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          shop_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          shop_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          shop_id: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          shop_id: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_id: string
          client_notes: string | null
          cost_total: number
          created_at: string
          date: string
          id: string
          lines: Json
          notes: string | null
          number: string
          profit: number
          shop_id: string
          signature_data: string | null
          signature_hash: string | null
          signed_at: string | null
          signer_name: string | null
          status: string
          subtotal: number
          token: string | null
          total: number
          validity_date: string
          vat_total: number
          vehicle_id: string
        }
        Insert: {
          client_id: string
          client_notes?: string | null
          cost_total?: number
          created_at?: string
          date?: string
          id?: string
          lines?: Json
          notes?: string | null
          number: string
          profit?: number
          shop_id: string
          signature_data?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          subtotal?: number
          token?: string | null
          total?: number
          validity_date?: string
          vat_total?: number
          vehicle_id: string
        }
        Update: {
          client_id?: string
          client_notes?: string | null
          cost_total?: number
          created_at?: string
          date?: string
          id?: string
          lines?: Json
          notes?: string | null
          number?: string
          profit?: number
          shop_id?: string
          signature_data?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string
          subtotal?: number
          token?: string | null
          total?: number
          validity_date?: string
          vat_total?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          free_months_balance: number
          id: string
          paid_referrals_count: number
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          free_months_balance?: number
          id?: string
          paid_referrals_count?: number
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          free_months_balance?: number
          id?: string
          paid_referrals_count?: number
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          id: string
          months_earned: number
          reward_type: string
          source_referral_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          months_earned?: number
          reward_type?: string
          source_referral_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          months_earned?: number
          reward_type?: string
          source_referral_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_rewards_source_referral_id_fkey"
            columns: ["source_referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          payment_confirmed: boolean
          plan: string | null
          referral_code: string
          referred_user_id: string | null
          referrer_user_id: string
          reward_given: boolean
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          payment_confirmed?: boolean
          plan?: string | null
          referral_code: string
          referred_user_id?: string | null
          referrer_user_id: string
          reward_given?: boolean
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          payment_confirmed?: boolean
          plan?: string | null
          referral_code?: string
          referred_user_id?: string | null
          referrer_user_id?: string
          reward_given?: boolean
          status?: string
        }
        Relationships: []
      }
      regional_admin_countries: {
        Row: {
          country_code: string
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          country_code: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          country_code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regional_admin_countries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
        ]
      }
      sale_confirmations: {
        Row: {
          buyer_confirmed: boolean
          buyer_email: string | null
          buyer_phone: string | null
          confirmation_token: string
          confirmed_at: string | null
          created_at: string
          id: string
          listing_id: string
          sale_price: number
          seller_confirmed: boolean
          seller_id: string
        }
        Insert: {
          buyer_confirmed?: boolean
          buyer_email?: string | null
          buyer_phone?: string | null
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id: string
          sale_price?: number
          seller_confirmed?: boolean
          seller_id: string
        }
        Update: {
          buyer_confirmed?: boolean
          buyer_email?: string | null
          buyer_phone?: string | null
          confirmation_token?: string
          confirmed_at?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          sale_price?: number
          seller_confirmed?: boolean
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_trust_scores: {
        Row: {
          avg_rating: number
          created_at: string
          disputed_sales: number
          id: string
          score_points: number
          successful_sales: number
          total_inspections: number
          total_sales: number
          trust_level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_rating?: number
          created_at?: string
          disputed_sales?: number
          id?: string
          score_points?: number
          successful_sales?: number
          total_inspections?: number
          total_sales?: number
          trust_level?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_rating?: number
          created_at?: string
          disputed_sales?: number
          id?: string
          score_points?: number
          successful_sales?: number
          total_inspections?: number
          total_sales?: number
          trust_level?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      service_catalog: {
        Row: {
          active: boolean
          created_at: string
          default_price: number
          default_time: number
          description: string | null
          id: string
          internal_cost: number
          name: string
          recurrence_km: number | null
          recurrence_months: number | null
          shop_id: string
          vat_rate: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_price?: number
          default_time?: number
          description?: string | null
          id?: string
          internal_cost?: number
          name: string
          recurrence_km?: number | null
          recurrence_months?: number | null
          shop_id: string
          vat_rate?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          default_price?: number
          default_time?: number
          description?: string | null
          id?: string
          internal_cost?: number
          name?: string
          recurrence_km?: number | null
          recurrence_months?: number | null
          shop_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      service_reminders: {
        Row: {
          client_id: string
          created_at: string
          id: string
          next_service_date: string | null
          next_service_km: number | null
          notified_at: string | null
          service_type: string
          shop_id: string
          status: string
          vehicle_id: string
          work_order_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          next_service_date?: string | null
          next_service_km?: number | null
          notified_at?: string | null
          service_type?: string
          shop_id: string
          status?: string
          vehicle_id: string
          work_order_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          next_service_date?: string | null
          next_service_km?: number | null
          notified_at?: string | null
          service_type?: string
          shop_id?: string
          status?: string
          vehicle_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_reminders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reminders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reminders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_reminders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          method: string
          notes: string | null
          paid_at: string | null
          reference: string | null
          shop_id: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          shop_id: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string | null
          reference?: string | null
          shop_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_payouts_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          inspection_id: string | null
          rating: number
          reviewer_id: string
          shop_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          inspection_id?: string | null
          rating: number
          reviewer_id: string
          shop_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          inspection_id?: string | null
          rating?: number
          reviewer_id?: string
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_reviews_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "carity_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_reviews_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_users: {
        Row: {
          created_at: string
          id: string
          role: string
          shop_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          shop_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          shop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_users_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          inspection_id: string | null
          payout_id: string | null
          shop_id: string
          type: string
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          inspection_id?: string | null
          payout_id?: string | null
          shop_id: string
          type?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          inspection_id?: string | null
          payout_id?: string | null
          shop_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_wallet_transactions_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "carity_inspections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_wallet_transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "shop_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_wallet_transactions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          shop_id: string
          status: string
          total_earned: number
          total_paid: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          shop_id: string
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          shop_id?: string
          status?: string
          total_earned?: number
          total_paid?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_wallets_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          address: string | null
          carity_active: boolean
          carity_approval_rate: number
          carity_inspections_count: number
          carity_priority: number
          carity_rating: number
          country: string
          country_code: string
          created_at: string
          currency: string
          email: string
          id: string
          is_carity_partner: boolean
          labor_rate: number
          language: string
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          nif: string | null
          phone: string
          primary_color: string | null
          slug: string | null
          status: string
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_onboarded: boolean
          stripe_connect_payouts_enabled: boolean
          timezone: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          address?: string | null
          carity_active?: boolean
          carity_approval_rate?: number
          carity_inspections_count?: number
          carity_priority?: number
          carity_rating?: number
          country?: string
          country_code?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          is_carity_partner?: boolean
          labor_rate?: number
          language?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          nif?: string | null
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          timezone?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          address?: string | null
          carity_active?: boolean
          carity_approval_rate?: number
          carity_inspections_count?: number
          carity_priority?: number
          carity_rating?: number
          country?: string
          country_code?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          is_carity_partner?: boolean
          labor_rate?: number
          language?: string
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          nif?: string | null
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          timezone?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "shops_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          part_id: string
          quantity: number
          reason: string | null
          shop_id: string
          type: string
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          part_id: string
          quantity: number
          reason?: string | null
          shop_id: string
          type?: string
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          part_id?: string
          quantity?: number
          reason?: string | null
          shop_id?: string
          type?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string
          created_at: string
          current_period_end: string | null
          discount_applied_at: string | null
          discount_applied_by: string | null
          discount_expires_at: string | null
          discount_percent: number
          discount_reason: string | null
          id: string
          plan: string
          revenue_type: string
          shop_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          discount_applied_at?: string | null
          discount_applied_by?: string | null
          discount_expires_at?: string | null
          discount_percent?: number
          discount_reason?: string | null
          id?: string
          plan?: string
          revenue_type?: string
          shop_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          created_at?: string
          current_period_end?: string | null
          discount_applied_at?: string | null
          discount_applied_by?: string | null
          discount_expires_at?: string | null
          discount_percent?: number
          discount_reason?: string | null
          id?: string
          plan?: string
          revenue_type?: string
          shop_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          discount_percent: number
          id: string
          invite_token: string
          last_reminder_at: string | null
          plan_offer: string
          reminder_count: number
          sent_at: string | null
          shop_email: string
          shop_id: string | null
          shop_name: string
          shop_phone: string
          status: string
          supplier_id: string
          trial_days: number
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          invite_token?: string
          last_reminder_at?: string | null
          plan_offer?: string
          reminder_count?: number
          sent_at?: string | null
          shop_email: string
          shop_id?: string | null
          shop_name?: string
          shop_phone?: string
          status?: string
          supplier_id: string
          trial_days?: number
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          discount_percent?: number
          id?: string
          invite_token?: string
          last_reminder_at?: string | null
          plan_offer?: string
          reminder_count?: number
          sent_at?: string | null
          shop_email?: string
          shop_id?: string | null
          shop_name?: string
          shop_phone?: string
          status?: string
          supplier_id?: string
          trial_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invites_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invites_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_parts: {
        Row: {
          brand: string
          category: string
          id: string
          name: string
          part_number: string
          price: number
          stock_available: number
          supplier_id: string
          updated_at: string
        }
        Insert: {
          brand?: string
          category?: string
          id?: string
          name: string
          part_number?: string
          price?: number
          stock_available?: number
          supplier_id: string
          updated_at?: string
        }
        Update: {
          brand?: string
          category?: string
          id?: string
          name?: string
          part_number?: string
          price?: number
          stock_available?: number
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_parts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string
          contact_phone: string
          created_at: string
          discount_percent: number
          id: string
          integration_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          discount_percent?: number
          id?: string
          integration_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          created_at?: string
          discount_percent?: number
          id?: string
          integration_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_response: string | null
          category: string
          contact_email: string
          contact_name: string | null
          contact_phone: string | null
          context: string
          created_at: string
          id: string
          message: string
          priority: string
          responded_at: string | null
          responded_by: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          category?: string
          contact_email: string
          contact_name?: string | null
          contact_phone?: string | null
          context?: string
          created_at?: string
          id?: string
          message: string
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          category?: string
          contact_email?: string
          contact_name?: string | null
          contact_phone?: string | null
          context?: string
          created_at?: string
          id?: string
          message?: string
          priority?: string
          responded_at?: string | null
          responded_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_broadcast_dismissals: {
        Row: {
          broadcast_id: string
          dismissed_at: string
          id: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          dismissed_at?: string
          id?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          dismissed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_broadcast_dismissals_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "system_broadcasts"
            referencedColumns: ["id"]
          },
        ]
      }
      system_broadcasts: {
        Row: {
          active: boolean
          audience: string
          country_filter: string | null
          created_at: string
          created_by: string | null
          dismissals_count: number
          ends_at: string | null
          id: string
          level: string
          link_label: string | null
          link_url: string | null
          message: string
          starts_at: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          active?: boolean
          audience?: string
          country_filter?: string | null
          created_at?: string
          created_by?: string | null
          dismissals_count?: number
          ends_at?: string | null
          id?: string
          level?: string
          link_label?: string | null
          link_url?: string | null
          message: string
          starts_at?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          active?: boolean
          audience?: string
          country_filter?: string | null
          created_at?: string
          created_by?: string | null
          dismissals_count?: number
          ends_at?: string | null
          id?: string
          level?: string
          link_label?: string | null
          link_url?: string | null
          message?: string
          starts_at?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      system_feature_flags: {
        Row: {
          category: string
          countries: string[]
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          rollout_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string
          countries?: string[]
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          countries?: string[]
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          rollout_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      trial_records: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          nif: string | null
          phone: string | null
          shop_id: string
          stripe_customer_id: string | null
          trial_end: string | null
          trial_start: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          nif?: string | null
          phone?: string | null
          shop_id: string
          stripe_customer_id?: string | null
          trial_end?: string | null
          trial_start?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          nif?: string | null
          phone?: string | null
          shop_id?: string
          stripe_customer_id?: string | null
          trial_end?: string | null
          trial_start?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_records_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vehicle_global_history: {
        Row: {
          created_at: string
          description: string | null
          event_date: string
          event_type: string
          id: string
          mileage: number | null
          parts_replaced: Json | null
          reference_id: string | null
          reference_type: string | null
          shop_id: string
          title: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          mileage?: number | null
          parts_replaced?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id: string
          title: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_date?: string
          event_type?: string
          id?: string
          mileage?: number | null
          parts_replaced?: Json | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string
          title?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_global_history_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_global_history_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          client_id: string
          created_at: string
          deleted_at: string | null
          fuel: string
          id: string
          make: string
          mileage: number
          model: string
          notes: string | null
          plate: string
          shop_id: string
          vin: string | null
          year: number
        }
        Insert: {
          client_id: string
          created_at?: string
          deleted_at?: string | null
          fuel?: string
          id?: string
          make: string
          mileage?: number
          model: string
          notes?: string | null
          plate: string
          shop_id: string
          vin?: string | null
          year?: number
        }
        Update: {
          client_id?: string
          created_at?: string
          deleted_at?: string | null
          fuel?: string
          id?: string
          make?: string
          mileage?: number
          model?: string
          notes?: string | null
          plate?: string
          shop_id?: string
          vin?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      warranties: {
        Row: {
          client_id: string
          coverage: string | null
          created_at: string
          description: string
          end_date: string
          id: string
          invoice_id: string | null
          notes: string | null
          shop_id: string
          start_date: string
          status: string
          type: string
          vehicle_id: string
          work_order_id: string | null
        }
        Insert: {
          client_id: string
          coverage?: string | null
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          shop_id: string
          start_date?: string
          status?: string
          type?: string
          vehicle_id: string
          work_order_id?: string | null
        }
        Update: {
          client_id?: string
          coverage?: string | null
          created_at?: string
          description?: string
          end_date?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          shop_id?: string
          start_date?: string
          status?: string
          type?: string
          vehicle_id?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          shop_id: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          shop_id: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          shop_id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_attachments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_times: {
        Row: {
          created_at: string
          duration_seconds: number
          end_time: string | null
          id: string
          notes: string | null
          shop_id: string
          start_time: string
          status: string
          technician_name: string
          work_order_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          shop_id: string
          start_time?: string
          status?: string
          technician_name?: string
          work_order_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          end_time?: string | null
          id?: string
          notes?: string | null
          shop_id?: string
          start_time?: string
          status?: string
          technician_name?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_times_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_times_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          client_description: string | null
          client_id: string
          completed_at: string | null
          cost_total: number
          created_at: string
          delivered_at: string | null
          diagnosis: string | null
          entry_mileage: number
          id: string
          labor_hours: number
          lines: Json
          notes: string | null
          number: string
          origin: string
          profit: number
          quote_id: string | null
          shop_id: string
          status: string
          subtotal: number
          technician: string | null
          total: number
          vat_total: number
          vehicle_id: string
        }
        Insert: {
          client_description?: string | null
          client_id: string
          completed_at?: string | null
          cost_total?: number
          created_at?: string
          delivered_at?: string | null
          diagnosis?: string | null
          entry_mileage?: number
          id?: string
          labor_hours?: number
          lines?: Json
          notes?: string | null
          number: string
          origin?: string
          profit?: number
          quote_id?: string | null
          shop_id: string
          status?: string
          subtotal?: number
          technician?: string | null
          total?: number
          vat_total?: number
          vehicle_id: string
        }
        Update: {
          client_description?: string | null
          client_id?: string
          completed_at?: string | null
          cost_total?: number
          created_at?: string
          delivered_at?: string | null
          diagnosis?: string | null
          entry_mileage?: number
          id?: string
          labor_hours?: number
          lines?: Json
          notes?: string | null
          number?: string
          origin?: string
          profit?: number
          quote_id?: string | null
          shop_id?: string
          status?: string
          subtotal?: number
          technician?: string | null
          total?: number
          vat_total?: number
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dealer_directory: {
        Row: {
          active_listings: number | null
          country_code: string | null
          dealer_city: string | null
          dealer_company_name: string | null
          dealer_description: string | null
          dealer_logo_url: string | null
          dealer_plan: string | null
          dealer_slug: string | null
          total_sold: number | null
          user_id: string | null
          verified: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
        ]
      }
      listing_view_stats: {
        Row: {
          listing_id: string | null
          views_today: number | null
          views_total: number | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_views_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cascade_delete_shop: { Args: { _shop_id: string }; Returns: undefined }
      check_shop_creation_limit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_trial_eligibility: {
        Args: {
          _email: string
          _nif?: string
          _phone?: string
          _stripe_customer_id?: string
        }
        Returns: boolean
      }
      dealer_can_publish: { Args: { _user_id: string }; Returns: Json }
      detect_workshop_anomalies: { Args: never; Returns: Json }
      flag_suspicious_transactions: { Args: never; Returns: Json }
      generate_report_hash: { Args: { _report_id: string }; Returns: string }
      get_admin_countries: { Args: { _user_id: string }; Returns: string[] }
      get_country_config: {
        Args: { _code: string }
        Returns: {
          active: boolean
          code: string
          created_at: string
          currency: string
          currency_symbol: string
          default_language: string
          flag_emoji: string
          inspection_platform_share: number
          inspection_price: number
          inspection_shop_share: number
          launch_date: string | null
          locale: string
          market_commission_rate: number
          name: string
          notes: string | null
          saas_garage_monthly: number
          saas_garage_yearly: number
          saas_pro_monthly: number
          saas_pro_yearly: number
          saas_trial_days: number
          stripe_garage_monthly: string | null
          stripe_garage_yearly: string | null
          stripe_pro_monthly: string | null
          stripe_pro_yearly: string | null
          supported_languages: string[]
          tax_label: string
          timezones: string[]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "country_settings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_seller_emails: {
        Args: { seller_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_shop_member_emails: {
        Args: { _shop_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_emails_for_admin: {
        Args: never
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_user_shop_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_regional_admin_for: {
        Args: { _country_code: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_shop_payout_paid: {
        Args: { _payout_id: string; _reference?: string }
        Returns: undefined
      }
      next_invoice_number: { Args: { _shop_id: string }; Returns: string }
      next_number: {
        Args: { _prefix: string; _shop_id: string }
        Returns: string
      }
      recalculate_trust_score: {
        Args: { _seller_id: string }
        Returns: undefined
      }
      redeem_coupon: {
        Args: { _code: string; _shop_id: string }
        Returns: Json
      }
      reject_shop_payout: {
        Args: { _payout_id: string; _reason?: string }
        Returns: undefined
      }
      request_shop_payout: {
        Args: {
          _amount: number
          _method?: string
          _notes?: string
          _shop_id: string
        }
        Returns: string
      }
      user_is_shop_member: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_shop: {
        Args: { _shop_id: string; _user_id: string }
        Returns: boolean
      }
      validate_inspection_coherence: {
        Args: { _listing_id: string; _report_id: string }
        Returns: Json
      }
      validate_plan_limit: {
        Args: { _action_type: string; _shop_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "buyer" | "seller" | "garage_owner" | "admin" | "regional_admin"
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
      app_role: ["buyer", "seller", "garage_owner", "admin", "regional_admin"],
    },
  },
} as const
