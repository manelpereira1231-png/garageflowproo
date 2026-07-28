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
      action_queue: {
        Row: {
          action_type: string
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          scheduled_at: string
          status: string
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_at?: string
          status?: string
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          attempts?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          payload?: Json
          scheduled_at?: string
          status?: string
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      action_trace: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          source_id: string | null
          source_table: string | null
          step: string
          trace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          step: string
          trace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          source_id?: string | null
          source_table?: string | null
          step?: string
          trace_id?: string
        }
        Relationships: []
      }
      action_whitelist: {
        Row: {
          action_type: string
          cooldown_hours: number
          created_at: string
          description: string | null
          enabled: boolean
        }
        Insert: {
          action_type: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
        }
        Update: {
          action_type?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
        }
        Relationships: []
      }
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
      ai_rate_limits: {
        Row: {
          count: number
          subject_id: string
          subject_type: string
          window_start: string
        }
        Insert: {
          count?: number
          subject_id: string
          subject_type: string
          window_start: string
        }
        Update: {
          count?: number
          subject_id?: string
          subject_type?: string
          window_start?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          function_name: string
          response: Json
          shop_id: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          function_name: string
          response: Json
          shop_id?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          function_name?: string
          response?: Json
          shop_id?: string | null
        }
        Relationships: []
      }
      ai_usage_ledger: {
        Row: {
          cached: boolean
          cost_estimate_eur: number
          created_at: string
          credits: number
          function_name: string
          id: string
          metadata: Json
          plan_slug: string | null
          prompt_hash: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          cached?: boolean
          cost_estimate_eur?: number
          created_at?: string
          credits?: number
          function_name: string
          id?: string
          metadata?: Json
          plan_slug?: string | null
          prompt_hash?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          cached?: boolean
          cost_estimate_eur?: number
          created_at?: string
          credits?: number
          function_name?: string
          id?: string
          metadata?: Json
          plan_slug?: string | null
          prompt_hash?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_ledger_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      anomaly_events: {
        Row: {
          anomaly_type: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          resolved: boolean
          severity: string
        }
        Insert: {
          anomaly_type: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          resolved?: boolean
          severity?: string
        }
        Update: {
          anomaly_type?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          resolved?: boolean
          severity?: string
        }
        Relationships: []
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
      api_logs: {
        Row: {
          created_at: string
          endpoint: string
          error: string | null
          id: string
          ip: string | null
          latency_ms: number | null
          method: string | null
          payload_size: number | null
          region: string | null
          service_name: string | null
          status_code: number | null
          trace_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          error?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number | null
          method?: string | null
          payload_size?: number | null
          region?: string | null
          service_name?: string | null
          status_code?: number | null
          trace_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: string
          ip?: string | null
          latency_ms?: number | null
          method?: string | null
          payload_size?: number | null
          region?: string | null
          service_name?: string | null
          status_code?: number | null
          trace_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          assigned_to: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string
          date: string
          duration_minutes: number
          id: string
          notes: string | null
          service_id: string | null
          service_type: string
          shop_id: string
          source: string
          status: string
          time: string
          vehicle_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          service_id?: string | null
          service_type?: string
          shop_id: string
          source?: string
          status?: string
          time: string
          vehicle_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          client_phone?: string | null
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          service_id?: string | null
          service_type?: string
          shop_id?: string
          source?: string
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
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
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
      business_forecasts: {
        Row: {
          forecast: Json
          generated_at: string
          generated_by: string | null
          id: string
          inputs: Json
          model: string | null
          notes: string | null
        }
        Insert: {
          forecast: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          inputs: Json
          model?: string | null
          notes?: string | null
        }
        Update: {
          forecast?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          inputs?: Json
          model?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      business_metrics_daily: {
        Row: {
          arpu_eur: number | null
          arr_eur: number | null
          cac_eur: number | null
          churn_rate: number | null
          churned_customers: number | null
          computed_at: string | null
          ltv_eur: number | null
          market_commission_eur: number | null
          market_gmv_eur: number | null
          mrr_eur: number | null
          new_signups: number | null
          payback_months: number | null
          paying_customers: number | null
          snapshot_date: string
          trial_customers: number | null
        }
        Insert: {
          arpu_eur?: number | null
          arr_eur?: number | null
          cac_eur?: number | null
          churn_rate?: number | null
          churned_customers?: number | null
          computed_at?: string | null
          ltv_eur?: number | null
          market_commission_eur?: number | null
          market_gmv_eur?: number | null
          mrr_eur?: number | null
          new_signups?: number | null
          payback_months?: number | null
          paying_customers?: number | null
          snapshot_date: string
          trial_customers?: number | null
        }
        Update: {
          arpu_eur?: number | null
          arr_eur?: number | null
          cac_eur?: number | null
          churn_rate?: number | null
          churned_customers?: number | null
          computed_at?: string | null
          ltv_eur?: number | null
          market_commission_eur?: number | null
          market_gmv_eur?: number | null
          mrr_eur?: number | null
          new_signups?: number | null
          payback_months?: number | null
          paying_customers?: number | null
          snapshot_date?: string
          trial_customers?: number | null
        }
        Relationships: []
      }
      buyer_reviews: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          listing_id: string | null
          rating: number
          reviewer_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating: number
          reviewer_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating?: number
          reviewer_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          audit_status: string
          brakes_photos: Json
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
          inspection_city: string | null
          inspection_country: string | null
          inspection_duration_seconds: number | null
          inspection_id: string
          inspection_lat: number | null
          inspection_lng: number | null
          inspector_notes: string | null
          interior_photos: Json
          is_locked: boolean
          listing_id: string
          locked_at: string | null
          mileage_at_inspection: number | null
          overall_score: number
          recommendation: string
          report_hash: string | null
          risk_calculated_at: string | null
          risk_flags: Json
          risk_level: string
          risk_score: number
          shop_id: string
          started_at: string | null
          steering_status: string
          submitted_by_user_id: string | null
          suspension_photos: Json
          suspension_status: string
          technician_name: string | null
          tire_photos: Json
          tires_status: string
          transmission_status: string
          verification_token: string | null
        }
        Insert: {
          audit_status?: string
          brakes_photos?: Json
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
          inspection_city?: string | null
          inspection_country?: string | null
          inspection_duration_seconds?: number | null
          inspection_id: string
          inspection_lat?: number | null
          inspection_lng?: number | null
          inspector_notes?: string | null
          interior_photos?: Json
          is_locked?: boolean
          listing_id: string
          locked_at?: string | null
          mileage_at_inspection?: number | null
          overall_score?: number
          recommendation?: string
          report_hash?: string | null
          risk_calculated_at?: string | null
          risk_flags?: Json
          risk_level?: string
          risk_score?: number
          shop_id: string
          started_at?: string | null
          steering_status?: string
          submitted_by_user_id?: string | null
          suspension_photos?: Json
          suspension_status?: string
          technician_name?: string | null
          tire_photos?: Json
          tires_status?: string
          transmission_status?: string
          verification_token?: string | null
        }
        Update: {
          audit_status?: string
          brakes_photos?: Json
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
          inspection_city?: string | null
          inspection_country?: string | null
          inspection_duration_seconds?: number | null
          inspection_id?: string
          inspection_lat?: number | null
          inspection_lng?: number | null
          inspector_notes?: string | null
          interior_photos?: Json
          is_locked?: boolean
          listing_id?: string
          locked_at?: string | null
          mileage_at_inspection?: number | null
          overall_score?: number
          recommendation?: string
          report_hash?: string | null
          risk_calculated_at?: string | null
          risk_flags?: Json
          risk_level?: string
          risk_score?: number
          shop_id?: string
          started_at?: string | null
          steering_status?: string
          submitted_by_user_id?: string | null
          suspension_photos?: Json
          suspension_status?: string
          technician_name?: string | null
          tire_photos?: Json
          tires_status?: string
          transmission_status?: string
          verification_token?: string | null
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
      carity_listing_translations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          language: string
          listing_id: string
          source_language: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          language: string
          listing_id: string
          source_language?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          language?: string
          listing_id?: string
          source_language?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carity_listing_translations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "carity_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      carity_listings: {
        Row: {
          boost_active: boolean
          boost_expires_at: string | null
          city: string | null
          commission_rate: number
          country_code: string
          created_at: string
          currency: string
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
          region: string | null
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
          city?: string | null
          commission_rate?: number
          country_code?: string
          created_at?: string
          currency?: string
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
          region?: string | null
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
          city?: string | null
          commission_rate?: number
          country_code?: string
          created_at?: string
          currency?: string
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
          region?: string | null
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
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
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
      complaints: {
        Row: {
          category: string
          context: string
          created_at: string | null
          description: string
          id: string
          related_entity_id: string | null
          related_entity_type: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          shop_id: string | null
          sla_breached: boolean | null
          sla_due_at: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          context?: string
          created_at?: string | null
          description: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shop_id?: string | null
          sla_breached?: boolean | null
          sla_due_at?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          context?: string
          created_at?: string | null
          description?: string
          id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          shop_id?: string | null
          sla_breached?: boolean | null
          sla_due_at?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
          saas_free_monthly: number
          saas_free_yearly: number
          saas_garage_monthly: number
          saas_garage_yearly: number
          saas_pro_monthly: number
          saas_pro_yearly: number
          saas_trial_days: number
          stripe_free_monthly: string | null
          stripe_free_product_id: string | null
          stripe_free_yearly: string | null
          stripe_garage_monthly: string | null
          stripe_garage_product_id: string | null
          stripe_garage_yearly: string | null
          stripe_pro_monthly: string | null
          stripe_pro_product_id: string | null
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
          saas_free_monthly?: number
          saas_free_yearly?: number
          saas_garage_monthly?: number
          saas_garage_yearly?: number
          saas_pro_monthly?: number
          saas_pro_yearly?: number
          saas_trial_days?: number
          stripe_free_monthly?: string | null
          stripe_free_product_id?: string | null
          stripe_free_yearly?: string | null
          stripe_garage_monthly?: string | null
          stripe_garage_product_id?: string | null
          stripe_garage_yearly?: string | null
          stripe_pro_monthly?: string | null
          stripe_pro_product_id?: string | null
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
          saas_free_monthly?: number
          saas_free_yearly?: number
          saas_garage_monthly?: number
          saas_garage_yearly?: number
          saas_pro_monthly?: number
          saas_pro_yearly?: number
          saas_trial_days?: number
          stripe_free_monthly?: string | null
          stripe_free_product_id?: string | null
          stripe_free_yearly?: string | null
          stripe_garage_monthly?: string | null
          stripe_garage_product_id?: string | null
          stripe_garage_yearly?: string | null
          stripe_pro_monthly?: string | null
          stripe_pro_product_id?: string | null
          stripe_pro_yearly?: string | null
          supported_languages?: string[]
          tax_label?: string
          timezones?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      crm_activity: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          lead_id: string | null
          meta: Json | null
          shop_id: string | null
          summary: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          meta?: Json | null
          shop_id?: string | null
          summary?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          meta?: Json | null
          shop_id?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_calls: {
        Row: {
          called_at: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          lead_id: string | null
          notes: string | null
          outcome: string
          shop_id: string | null
        }
        Insert: {
          called_at?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome: string
          shop_id?: string | null
        }
        Update: {
          called_at?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          outcome?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          address: string | null
          assigned_to: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          estimated_value: number | null
          id: string
          import_batch_id: string | null
          last_contact_at: string | null
          name: string
          next_contact_at: string | null
          notes: string | null
          owner_name: string | null
          phone: string | null
          pipeline_stage: string
          priority: string | null
          shop_id: string | null
          shop_link_id: string | null
          source: string | null
          status: string
          target_plan: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          name: string
          next_contact_at?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: string | null
          shop_id?: string | null
          shop_link_id?: string | null
          source?: string | null
          status?: string
          target_plan?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          assigned_to?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          estimated_value?: number | null
          id?: string
          import_batch_id?: string | null
          last_contact_at?: string | null
          name?: string
          next_contact_at?: string | null
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: string | null
          shop_id?: string | null
          shop_link_id?: string | null
          source?: string | null
          status?: string
          target_plan?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_shop_link_id_fkey"
            columns: ["shop_link_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_meetings: {
        Row: {
          created_at: string
          created_by: string | null
          duration_minutes: number | null
          id: string
          lead_id: string | null
          location: string | null
          meeting_type: string
          meeting_url: string | null
          notes: string | null
          scheduled_at: string
          shop_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_type?: string
          meeting_url?: string | null
          notes?: string | null
          scheduled_at: string
          shop_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_type?: string
          meeting_url?: string | null
          notes?: string | null
          scheduled_at?: string
          shop_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_meetings_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_meetings_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
          shop_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          shop_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          metric: string
          owner_id: string | null
          period: string
          period_end: string
          period_start: string
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric: string
          owner_id?: string | null
          period: string
          period_end: string
          period_start: string
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          metric?: string
          owner_id?: string | null
          period?: string
          period_end?: string
          period_start?: string
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          id: string
          lead_id: string | null
          priority: string | null
          shop_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          shop_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          shop_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_health_scores: {
        Row: {
          activity_30d: number | null
          activity_7d: number | null
          activity_drop_pct: number | null
          churn_risk: string
          health_score: number
          last_invoice_at: string | null
          last_login_at: string | null
          predicted_churn_date: string | null
          recommended_action: string | null
          shop_id: string
          updated_at: string | null
        }
        Insert: {
          activity_30d?: number | null
          activity_7d?: number | null
          activity_drop_pct?: number | null
          churn_risk?: string
          health_score?: number
          last_invoice_at?: string | null
          last_login_at?: string | null
          predicted_churn_date?: string | null
          recommended_action?: string | null
          shop_id: string
          updated_at?: string | null
        }
        Update: {
          activity_30d?: number | null
          activity_7d?: number | null
          activity_drop_pct?: number | null
          churn_risk?: string
          health_score?: number
          last_invoice_at?: string | null
          last_login_at?: string | null
          predicted_churn_date?: string | null
          recommended_action?: string | null
          shop_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      demo_requests: {
        Row: {
          archived_at: string | null
          assigned_to: string | null
          best_contact_time: string | null
          city: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          current_software: string | null
          email: string
          employees: string | null
          id: string
          ip_address: string | null
          name: string
          notes: string | null
          phone: string
          scheduled_at: string | null
          shop_name: string
          source: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          archived_at?: string | null
          assigned_to?: string | null
          best_contact_time?: string | null
          city?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          current_software?: string | null
          email: string
          employees?: string | null
          id?: string
          ip_address?: string | null
          name: string
          notes?: string | null
          phone: string
          scheduled_at?: string | null
          shop_name: string
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          archived_at?: string | null
          assigned_to?: string | null
          best_contact_time?: string | null
          city?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          current_software?: string | null
          email?: string
          employees?: string | null
          id?: string
          ip_address?: string | null
          name?: string
          notes?: string | null
          phone?: string
          scheduled_at?: string | null
          shop_name?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      email_campaign_metrics: {
        Row: {
          campaign_id: string
          click_count: number
          click_rate: number
          computed_at: string
          conversion_count: number
          conversion_rate: number
          delivered_count: number
          id: string
          open_count: number
          open_rate: number
          sent_count: number
        }
        Insert: {
          campaign_id: string
          click_count?: number
          click_rate?: number
          computed_at?: string
          conversion_count?: number
          conversion_rate?: number
          delivered_count?: number
          id?: string
          open_count?: number
          open_rate?: number
          sent_count?: number
        }
        Update: {
          campaign_id?: string
          click_count?: number
          click_rate?: number
          computed_at?: string
          conversion_count?: number
          conversion_rate?: number
          delivered_count?: number
          id?: string
          open_count?: number
          open_rate?: number
          sent_count?: number
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          details: Json | null
          email_id: string
          email_type: string | null
          event_type: string
          id: string
          recipient: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          email_id: string
          email_type?: string | null
          event_type: string
          id?: string
          recipient?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          email_id?: string
          email_type?: string | null
          event_type?: string
          id?: string
          recipient?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_lifecycle_log: {
        Row: {
          entity_id: string
          error: string | null
          id: string
          recipient: string
          sent_at: string
          shop_id: string
          status: string
          template_key: string
        }
        Insert: {
          entity_id: string
          error?: string | null
          id?: string
          recipient: string
          sent_at?: string
          shop_id: string
          status?: string
          template_key: string
        }
        Update: {
          entity_id?: string
          error?: string | null
          id?: string
          recipient?: string
          sent_at?: string
          shop_id?: string
          status?: string
          template_key?: string
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          created_at: string
          enabled: boolean
          html_body: string
          id: string
          shop_id: string
          subject: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          html_body: string
          id?: string
          shop_id: string
          subject: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          html_body?: string
          id?: string
          shop_id?: string
          subject?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      email_tracking_events: {
        Row: {
          created_at: string
          email_id: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_id: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      entity_state: {
        Row: {
          conversion_score: number
          created_at: string
          entity_id: string
          entity_type: string
          health_score: number
          id: string
          last_activity_at: string | null
          lifecycle_state: string
          metadata: Json
          updated_at: string
        }
        Insert: {
          conversion_score?: number
          created_at?: string
          entity_id: string
          entity_type: string
          health_score?: number
          id?: string
          last_activity_at?: string | null
          lifecycle_state?: string
          metadata?: Json
          updated_at?: string
        }
        Update: {
          conversion_score?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          health_score?: number
          id?: string
          last_activity_at?: string | null
          lifecycle_state?: string
          metadata?: Json
          updated_at?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          created_at: string
          event_name: string
          id: string
          payload: Json
          session_id: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          payload?: Json
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          payload?: Json
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_logs_archive: {
        Row: {
          created_at: string
          event_name: string
          id: string
          payload: Json
          session_id: string | null
          shop_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          payload?: Json
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          payload?: Json
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      failed_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          job_type: string
          payload: Json
          resolved: boolean
          resolved_at: string | null
          retry_count: number
          source_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          job_type: string
          payload?: Json
          resolved?: boolean
          resolved_at?: string | null
          retry_count?: number
          source_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          job_type?: string
          payload?: Json
          resolved?: boolean
          resolved_at?: string | null
          retry_count?: number
          source_id?: string | null
        }
        Relationships: []
      }
      features: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          icon: string | null
          is_core: boolean
          name: string
          order_index: number
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          is_core?: boolean
          name: string
          order_index?: number
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          is_core?: boolean
          name?: string
          order_index?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      funnel_events: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          source_event: string | null
          stage: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          source_event?: string | null
          stage: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          source_event?: string | null
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      funnel_events_archive: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          source_event: string | null
          stage: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          source_event?: string | null
          stage: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          source_event?: string | null
          stage?: string
          user_id?: string | null
        }
        Relationships: []
      }
      growth_opportunities_v2: {
        Row: {
          action_priority: string
          auto_action_eligible: boolean
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_calculated_at: string
          opportunity_type: string
          reason: string | null
          recommended_actions: Json
          score: number
          status: string
        }
        Insert: {
          action_priority?: string
          auto_action_eligible?: boolean
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_calculated_at?: string
          opportunity_type: string
          reason?: string | null
          recommended_actions?: Json
          score?: number
          status?: string
        }
        Update: {
          action_priority?: string
          auto_action_eligible?: boolean
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_calculated_at?: string
          opportunity_type?: string
          reason?: string | null
          recommended_actions?: Json
          score?: number
          status?: string
        }
        Relationships: []
      }
      gsn_admin_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      gsn_carrier_shipments: {
        Row: {
          carrier: string
          created_at: string
          delivered_at: string | null
          id: string
          metadata: Json
          order_id: string
          shipped_at: string | null
          status: string
          supplier_id: string
          tracking_code: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          carrier: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          order_id: string
          shipped_at?: string | null
          status?: string
          supplier_id: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          metadata?: Json
          order_id?: string
          shipped_at?: string | null
          status?: string
          supplier_id?: string
          tracking_code?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_carrier_shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_carrier_shipments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_carriers: {
        Row: {
          active: boolean
          base_price: number
          code: string | null
          created_at: string
          id: string
          metadata: Json
          name: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_price?: number
          code?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_price?: number
          code?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_carriers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          supplier_id: string
          unit_price: number
          updated_at: string
          vat: number
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          supplier_id: string
          unit_price?: number
          updated_at?: string
          vat?: number
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          supplier_id?: string
          unit_price?: number
          updated_at?: string
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "gsn_cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "gsn_carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gsn_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_cart_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_carts: {
        Row: {
          created_at: string
          id: string
          shop_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shop_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shop_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gsn_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "gsn_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_complaints: {
        Row: {
          body: string | null
          buyer_user_id: string | null
          created_at: string
          id: string
          order_id: string | null
          resolution: string | null
          shop_id: string | null
          status: string
          subject: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          resolution?: string | null
          shop_id?: string | null
          status?: string
          subject: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          buyer_user_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          resolution?: string | null
          shop_id?: string | null
          status?: string
          subject?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_complaints_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          starts_at: string | null
          supplier_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          supplier_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          starts_at?: string | null
          supplier_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gsn_coupons_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_favorites: {
        Row: {
          created_at: string
          id: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          supplier_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_favorites_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_favorites_products: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_favorites_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gsn_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_invoices: {
        Row: {
          commission_total: number
          created_at: string
          currency: string
          discount_total: number
          id: string
          number: string | null
          order_id: string | null
          pdf_url: string | null
          shipping_total: number
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
          vat_total: number
        }
        Insert: {
          commission_total?: number
          created_at?: string
          currency?: string
          discount_total?: number
          id?: string
          number?: string | null
          order_id?: string | null
          pdf_url?: string | null
          shipping_total?: number
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
          vat_total?: number
        }
        Update: {
          commission_total?: number
          created_at?: string
          currency?: string
          discount_total?: number
          id?: string
          number?: string | null
          order_id?: string | null
          pdf_url?: string | null
          shipping_total?: number
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "gsn_invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["gsn_notification_kind"]
          link: string | null
          metadata: Json
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["gsn_notification_kind"]
          link?: string | null
          metadata?: Json
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["gsn_notification_kind"]
          link?: string | null
          metadata?: Json
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      gsn_order_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          from_status: string | null
          id: string
          metadata: Json
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          order_id: string
          product_id: string | null
          quantity: number
          sku: string | null
          title: string | null
          unit_price: number
          vat: number
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          order_id: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title?: string | null
          unit_price?: number
          vat?: number
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku?: string | null
          title?: string | null
          unit_price?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "gsn_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gsn_products"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_orders: {
        Row: {
          buyer_shop_id: string | null
          buyer_user_id: string | null
          carrier: string | null
          commission_total: number
          created_at: string
          currency: string
          discount_total: number
          id: string
          metadata: Json
          notes: string | null
          shipping_total: number
          status: string
          subtotal: number
          supplier_id: string
          total: number
          tracking_code: string | null
          updated_at: string
          vat_total: number
        }
        Insert: {
          buyer_shop_id?: string | null
          buyer_user_id?: string | null
          carrier?: string | null
          commission_total?: number
          created_at?: string
          currency?: string
          discount_total?: number
          id?: string
          metadata?: Json
          notes?: string | null
          shipping_total?: number
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
          vat_total?: number
        }
        Update: {
          buyer_shop_id?: string | null
          buyer_user_id?: string | null
          carrier?: string | null
          commission_total?: number
          created_at?: string
          currency?: string
          discount_total?: number
          id?: string
          metadata?: Json
          notes?: string | null
          shipping_total?: number
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          tracking_code?: string | null
          updated_at?: string
          vat_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "gsn_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_payment_intents: {
        Row: {
          amount: number
          commission_amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          order_id: string | null
          shop_id: string | null
          state: Database["public"]["Enums"]["gsn_payment_state"]
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          shop_id?: string | null
          state?: Database["public"]["Enums"]["gsn_payment_state"]
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          commission_amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          shop_id?: string | null
          state?: Database["public"]["Enums"]["gsn_payment_state"]
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_payment_intents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_payment_intents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          metadata: Json
          order_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_products: {
        Row: {
          brand: string | null
          category: string | null
          compatibility: Json
          condition: Database["public"]["Enums"]["gsn_product_condition"]
          created_at: string
          currency: string
          datasheet: string | null
          deleted_at: string | null
          description: string | null
          discount_price: number | null
          ean: string | null
          gallery: Json
          height: number | null
          id: string
          image: string | null
          length: number | null
          manual_pdf: string | null
          manufacturer_reference: string | null
          model: string | null
          price: number
          reserved_stock: number
          sku: string | null
          status: Database["public"]["Enums"]["gsn_product_status"]
          stock: number
          subcategory: string | null
          supplier_id: string
          technical_description: string | null
          title: string
          updated_at: string
          vat: number
          weight: number | null
          width: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          compatibility?: Json
          condition?: Database["public"]["Enums"]["gsn_product_condition"]
          created_at?: string
          currency?: string
          datasheet?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_price?: number | null
          ean?: string | null
          gallery?: Json
          height?: number | null
          id?: string
          image?: string | null
          length?: number | null
          manual_pdf?: string | null
          manufacturer_reference?: string | null
          model?: string | null
          price?: number
          reserved_stock?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["gsn_product_status"]
          stock?: number
          subcategory?: string | null
          supplier_id: string
          technical_description?: string | null
          title: string
          updated_at?: string
          vat?: number
          weight?: number | null
          width?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          compatibility?: Json
          condition?: Database["public"]["Enums"]["gsn_product_condition"]
          created_at?: string
          currency?: string
          datasheet?: string | null
          deleted_at?: string | null
          description?: string | null
          discount_price?: number | null
          ean?: string | null
          gallery?: Json
          height?: number | null
          id?: string
          image?: string | null
          length?: number | null
          manual_pdf?: string | null
          manufacturer_reference?: string | null
          model?: string | null
          price?: number
          reserved_stock?: number
          sku?: string | null
          status?: Database["public"]["Enums"]["gsn_product_status"]
          stock?: number
          subcategory?: string | null
          supplier_id?: string
          technical_description?: string | null
          title?: string
          updated_at?: string
          vat?: number
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gsn_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_promotion_redemptions: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string | null
          promotion_id: string
          shop_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          promotion_id: string
          shop_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string | null
          promotion_id?: string
          shop_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gsn_promotion_redemptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_promotion_redemptions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "gsn_promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_promotions: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          supplier_id: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          supplier_id: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          supplier_id?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gsn_promotions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_reviews: {
        Row: {
          buyer_user_id: string | null
          comment: string | null
          created_at: string
          id: string
          moderated: boolean
          order_id: string | null
          rating_delivery: number | null
          rating_overall: number | null
          rating_price: number | null
          rating_quality: number | null
          rating_service: number | null
          reply: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          buyer_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          moderated?: boolean
          order_id?: string | null
          rating_delivery?: number | null
          rating_overall?: number | null
          rating_price?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          reply?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          buyer_user_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          moderated?: boolean
          order_id?: string | null
          rating_delivery?: number | null
          rating_overall?: number | null
          rating_price?: number | null
          rating_quality?: number | null
          rating_service?: number | null
          reply?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsn_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "gsn_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_reviews_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          reason: string | null
          supplier_id: string
          type: Database["public"]["Enums"]["gsn_stock_move_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          reason?: string | null
          supplier_id: string
          type: Database["public"]["Enums"]["gsn_stock_move_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          reason?: string | null
          supplier_id?: string
          type?: Database["public"]["Enums"]["gsn_stock_move_type"]
        }
        Relationships: [
          {
            foreignKeyName: "gsn_stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "gsn_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gsn_stock_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_supplier_applications: {
        Row: {
          accepted_terms: boolean
          address: string | null
          admin_notes: string | null
          average_delivery_time: string | null
          brands: string[] | null
          carriers: string[] | null
          categories: string[] | null
          city: string | null
          company_name: string
          country: string | null
          created_at: string
          created_supplier_id: string | null
          description: string | null
          district: string | null
          email: string
          id: string
          ip_hash: string | null
          phone: string | null
          postal_code: string | null
          rejection_reason: string | null
          responsible_name: string
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          state: Database["public"]["Enums"]["gsn_supplier_state"]
          trade_name: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          accepted_terms?: boolean
          address?: string | null
          admin_notes?: string | null
          average_delivery_time?: string | null
          brands?: string[] | null
          carriers?: string[] | null
          categories?: string[] | null
          city?: string | null
          company_name: string
          country?: string | null
          created_at?: string
          created_supplier_id?: string | null
          description?: string | null
          district?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          phone?: string | null
          postal_code?: string | null
          rejection_reason?: string | null
          responsible_name: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          state?: Database["public"]["Enums"]["gsn_supplier_state"]
          trade_name?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          accepted_terms?: boolean
          address?: string | null
          admin_notes?: string | null
          average_delivery_time?: string | null
          brands?: string[] | null
          carriers?: string[] | null
          categories?: string[] | null
          city?: string | null
          company_name?: string
          country?: string | null
          created_at?: string
          created_supplier_id?: string | null
          description?: string | null
          district?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          phone?: string | null
          postal_code?: string | null
          rejection_reason?: string | null
          responsible_name?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          state?: Database["public"]["Enums"]["gsn_supplier_state"]
          trade_name?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gsn_supplier_applications_created_supplier_id_fkey"
            columns: ["created_supplier_id"]
            isOneToOne: false
            referencedRelation: "gsn_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      gsn_supplier_invites: {
        Row: {
          city: string | null
          commission_percentage: number | null
          company_name: string
          country: string | null
          created_at: string
          district: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          notes: string | null
          phone: string | null
          plan: string | null
          token: string
          trade_name: string | null
          updated_at: string
          used_at: string | null
          used_by: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          city?: string | null
          commission_percentage?: number | null
          company_name: string
          country?: string | null
          created_at?: string
          district?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          phone?: string | null
          plan?: string | null
          token: string
          trade_name?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          city?: string | null
          commission_percentage?: number | null
          company_name?: string
          country?: string | null
          created_at?: string
          district?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          notes?: string | null
          phone?: string | null
          plan?: string | null
          token?: string
          trade_name?: string | null
          updated_at?: string
          used_at?: string | null
          used_by?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: []
      }
      gsn_suppliers: {
        Row: {
          active: boolean
          address: string | null
          application_source: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          average_delivery_time: string | null
          banner_url: string | null
          city: string | null
          commission_percentage: number
          company_name: string
          country: string | null
          created_at: string
          deleted_at: string | null
          delivery_available: boolean
          description: string | null
          district: string | null
          docs: Json
          email: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          logo_url: string | null
          minimum_order: number | null
          owner_user_id: string | null
          phone: string | null
          pickup_available: boolean
          postal_code: string | null
          rating_average: number
          rating_count: number
          rejection_reason: string | null
          slug: string | null
          state: Database["public"]["Enums"]["gsn_supplier_state"]
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_payouts_enabled: boolean
          subscription_plan: string | null
          subscription_status: string | null
          support_email: string | null
          support_phone: string | null
          suspended: boolean
          trade_name: string | null
          updated_at: string
          vat_number: string | null
          website: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          application_source?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          average_delivery_time?: string | null
          banner_url?: string | null
          city?: string | null
          commission_percentage?: number
          company_name: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_available?: boolean
          description?: string | null
          district?: string | null
          docs?: Json
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          logo_url?: string | null
          minimum_order?: number | null
          owner_user_id?: string | null
          phone?: string | null
          pickup_available?: boolean
          postal_code?: string | null
          rating_average?: number
          rating_count?: number
          rejection_reason?: string | null
          slug?: string | null
          state?: Database["public"]["Enums"]["gsn_supplier_state"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          subscription_plan?: string | null
          subscription_status?: string | null
          support_email?: string | null
          support_phone?: string | null
          suspended?: boolean
          trade_name?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          application_source?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          average_delivery_time?: string | null
          banner_url?: string | null
          city?: string | null
          commission_percentage?: number
          company_name?: string
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          delivery_available?: boolean
          description?: string | null
          district?: string | null
          docs?: Json
          email?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          logo_url?: string | null
          minimum_order?: number | null
          owner_user_id?: string | null
          phone?: string | null
          pickup_available?: boolean
          postal_code?: string | null
          rating_average?: number
          rating_count?: number
          rejection_reason?: string | null
          slug?: string | null
          state?: Database["public"]["Enums"]["gsn_supplier_state"]
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_payouts_enabled?: boolean
          subscription_plan?: string | null
          subscription_status?: string | null
          support_email?: string | null
          support_phone?: string | null
          suspended?: boolean
          trade_name?: string | null
          updated_at?: string
          vat_number?: string | null
          website?: string | null
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
          {
            foreignKeyName: "inspection_checklists_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      integracao_faturacao: {
        Row: {
          account_name: string
          api_key_encrypted: string
          ativo: boolean
          created_at: string
          documento_default: string
          id: string
          last_error: string | null
          last_test_ok_at: string | null
          moloni_company_id: number | null
          provider: string
          refresh_token_encrypted: string | null
          serie_default: string | null
          shop_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          account_name: string
          api_key_encrypted: string
          ativo?: boolean
          created_at?: string
          documento_default?: string
          id?: string
          last_error?: string | null
          last_test_ok_at?: string | null
          moloni_company_id?: number | null
          provider: string
          refresh_token_encrypted?: string | null
          serie_default?: string | null
          shop_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          account_name?: string
          api_key_encrypted?: string
          ativo?: boolean
          created_at?: string
          documento_default?: string
          id?: string
          last_error?: string | null
          last_test_ok_at?: string | null
          moloni_company_id?: number | null
          provider?: string
          refresh_token_encrypted?: string | null
          serie_default?: string | null
          shop_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integracao_faturacao_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
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
          atcud: string | null
          cancelled_at: string | null
          certified_series: string | null
          client_id: string
          created_at: string
          credit_note_atcud: string | null
          credit_note_number: string | null
          credit_note_pdf_url: string | null
          credit_note_permalink: string | null
          credit_note_provider_id: string | null
          currency: string
          due_date: string | null
          emitida_em: string | null
          id: string
          legal_status: string
          notes: string | null
          number: string
          provider: string | null
          provider_invoice_id: string | null
          provider_pdf_url: string | null
          provider_permalink: string | null
          qr_code: string | null
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
          atcud?: string | null
          cancelled_at?: string | null
          certified_series?: string | null
          client_id: string
          created_at?: string
          credit_note_atcud?: string | null
          credit_note_number?: string | null
          credit_note_pdf_url?: string | null
          credit_note_permalink?: string | null
          credit_note_provider_id?: string | null
          currency?: string
          due_date?: string | null
          emitida_em?: string | null
          id?: string
          legal_status?: string
          notes?: string | null
          number: string
          provider?: string | null
          provider_invoice_id?: string | null
          provider_pdf_url?: string | null
          provider_permalink?: string | null
          qr_code?: string | null
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
          atcud?: string | null
          cancelled_at?: string | null
          certified_series?: string | null
          client_id?: string
          created_at?: string
          credit_note_atcud?: string | null
          credit_note_number?: string | null
          credit_note_pdf_url?: string | null
          credit_note_permalink?: string | null
          credit_note_provider_id?: string | null
          currency?: string
          due_date?: string | null
          emitida_em?: string | null
          id?: string
          legal_status?: string
          notes?: string | null
          number?: string
          provider?: string | null
          provider_invoice_id?: string | null
          provider_pdf_url?: string | null
          provider_permalink?: string | null
          qr_code?: string | null
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
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes_public"
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
          {
            foreignKeyName: "invoices_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_articles: {
        Row: {
          body_md: string
          category: string
          context: string
          created_at: string | null
          created_by: string | null
          helpful_count: number | null
          id: string
          is_faq: boolean | null
          is_published: boolean | null
          language: string
          not_helpful_count: number | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
          views_count: number | null
        }
        Insert: {
          body_md: string
          category?: string
          context?: string
          created_at?: string | null
          created_by?: string | null
          helpful_count?: number | null
          id?: string
          is_faq?: boolean | null
          is_published?: boolean | null
          language?: string
          not_helpful_count?: number | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          views_count?: number | null
        }
        Update: {
          body_md?: string
          category?: string
          context?: string
          created_at?: string | null
          created_by?: string | null
          helpful_count?: number | null
          id?: string
          is_faq?: boolean | null
          is_published?: boolean | null
          language?: string
          not_helpful_count?: number | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          views_count?: number | null
        }
        Relationships: []
      }
      landing_visits: {
        Row: {
          campaign: string | null
          confidence: string | null
          country_hint: string | null
          created_at: string
          device_type: string | null
          first_touch_source: string | null
          gclid: string | null
          hostname: string | null
          id: string
          internal_reason: string | null
          is_internal: boolean | null
          landing_path: string | null
          medium: string | null
          referrer: string | null
          scroll_depth: number | null
          session_id: string | null
          source: string | null
          time_on_page: number | null
          user_agent: string | null
        }
        Insert: {
          campaign?: string | null
          confidence?: string | null
          country_hint?: string | null
          created_at?: string
          device_type?: string | null
          first_touch_source?: string | null
          gclid?: string | null
          hostname?: string | null
          id?: string
          internal_reason?: string | null
          is_internal?: boolean | null
          landing_path?: string | null
          medium?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string | null
          source?: string | null
          time_on_page?: number | null
          user_agent?: string | null
        }
        Update: {
          campaign?: string | null
          confidence?: string | null
          country_hint?: string | null
          created_at?: string
          device_type?: string | null
          first_touch_source?: string | null
          gclid?: string | null
          hostname?: string | null
          id?: string
          internal_reason?: string | null
          is_internal?: boolean | null
          landing_path?: string | null
          medium?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string | null
          source?: string | null
          time_on_page?: number | null
          user_agent?: string | null
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
      marketing_campaigns: {
        Row: {
          ab_variants: Json
          ai_model: string | null
          angle: string | null
          channels: string[]
          created_at: string
          ctas: string[]
          descriptions: string[]
          forecast: Json | null
          generated_by: string
          geo: string[]
          headlines: string[]
          id: string
          image_url: string | null
          keywords: string[]
          market: string
          monthly_budget_eur: number | null
          status: string
          strategy: string
          target_audience: Json
          title: string
          updated_at: string
        }
        Insert: {
          ab_variants?: Json
          ai_model?: string | null
          angle?: string | null
          channels?: string[]
          created_at?: string
          ctas?: string[]
          descriptions?: string[]
          forecast?: Json | null
          generated_by: string
          geo?: string[]
          headlines?: string[]
          id?: string
          image_url?: string | null
          keywords?: string[]
          market?: string
          monthly_budget_eur?: number | null
          status?: string
          strategy: string
          target_audience?: Json
          title: string
          updated_at?: string
        }
        Update: {
          ab_variants?: Json
          ai_model?: string | null
          angle?: string | null
          channels?: string[]
          created_at?: string
          ctas?: string[]
          descriptions?: string[]
          forecast?: Json | null
          generated_by?: string
          geo?: string[]
          headlines?: string[]
          id?: string
          image_url?: string | null
          keywords?: string[]
          market?: string
          monthly_budget_eur?: number | null
          status?: string
          strategy?: string
          target_audience?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_creatives: {
        Row: {
          ai_model: string | null
          campaign_id: string | null
          created_at: string
          creative_type: string
          error: string | null
          generated_by: string
          id: string
          image_url: string | null
          prompt: string
          status: string
          storage_path: string | null
        }
        Insert: {
          ai_model?: string | null
          campaign_id?: string | null
          created_at?: string
          creative_type: string
          error?: string | null
          generated_by: string
          id?: string
          image_url?: string | null
          prompt: string
          status?: string
          storage_path?: string | null
        }
        Update: {
          ai_model?: string | null
          campaign_id?: string | null
          created_at?: string
          creative_type?: string
          error?: string | null
          generated_by?: string
          id?: string
          image_url?: string | null
          prompt?: string
          status?: string
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_creatives_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_optimizations: {
        Row: {
          campaign_id: string
          changes: Json
          created_at: string
          id: string
          iteration: number
          performed_by: string
          reasoning: string | null
          simulated_metrics: Json | null
        }
        Insert: {
          campaign_id: string
          changes?: Json
          created_at?: string
          id?: string
          iteration?: number
          performed_by: string
          reasoning?: string | null
          simulated_metrics?: Json | null
        }
        Update: {
          campaign_id?: string
          changes?: Json
          created_at?: string
          id?: string
          iteration?: number
          performed_by?: string
          reasoning?: string | null
          simulated_metrics?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_optimizations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_posts: {
        Row: {
          body: string
          campaign_id: string | null
          channel: string
          created_at: string
          cta: string | null
          external_post_id: string | null
          external_url: string | null
          hashtags: string[] | null
          id: string
          image_prompt: string | null
          image_url: string | null
          metadata: Json | null
          post_type: string
          published_at: string | null
          scheduled_for: string | null
          status: string
          title: string | null
          updated_at: string
        }
        Insert: {
          body: string
          campaign_id?: string | null
          channel: string
          created_at?: string
          cta?: string | null
          external_post_id?: string | null
          external_url?: string | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          metadata?: Json | null
          post_type?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          cta?: string | null
          external_post_id?: string | null
          external_url?: string | null
          hashtags?: string[] | null
          id?: string
          image_prompt?: string | null
          image_url?: string | null
          metadata?: Json | null
          post_type?: string
          published_at?: string | null
          scheduled_for?: string | null
          status?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_publish_log: {
        Row: {
          action: string
          campaign_id: string | null
          channel: string
          created_at: string
          error: string | null
          id: string
          mode: string
          payload: Json | null
          post_id: string | null
          response: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          action: string
          campaign_id?: string | null
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          mode: string
          payload?: Json | null
          post_id?: string | null
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          campaign_id?: string | null
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          mode?: string
          payload?: Json | null
          post_id?: string | null
          response?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_publish_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_publish_log_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "marketing_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_activation_requests: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          requested_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          shop_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          requested_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shop_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_activation_requests_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          allowed_hours_end: number
          allowed_hours_start: number
          auto_send: boolean
          body_text: string
          channel: string
          created_at: string
          event_slug: string
          id: string
          name: string
          schedule_minutes: number
          shop_id: string
          subject: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          allowed_hours_end?: number
          allowed_hours_start?: number
          auto_send?: boolean
          body_text?: string
          channel?: string
          created_at?: string
          event_slug: string
          id?: string
          name: string
          schedule_minutes?: number
          shop_id: string
          subject?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          allowed_hours_end?: number
          allowed_hours_start?: number
          auto_send?: boolean
          body_text?: string
          channel?: string
          created_at?: string
          event_slug?: string
          id?: string
          name?: string
          schedule_minutes?: number
          shop_id?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          archived_at: string | null
          created_at: string
          data: Json | null
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
          archived_at?: string | null
          created_at?: string
          data?: Json | null
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
          archived_at?: string | null
          created_at?: string
          data?: Json | null
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
          {
            foreignKeyName: "parts_orders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
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
      pilot_leads: {
        Row: {
          activated_at: string | null
          assigned_to: string | null
          city: string | null
          contact_name: string | null
          contacted_at: string | null
          created_at: string
          current_tool: string | null
          demo_at: string | null
          email: string | null
          id: string
          lost_reason: string | null
          notes: string | null
          phone: string
          source: string | null
          status: string
          team_size: string | null
          updated_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          workshop_name: string
        }
        Insert: {
          activated_at?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          contacted_at?: string | null
          created_at?: string
          current_tool?: string | null
          demo_at?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          phone: string
          source?: string | null
          status?: string
          team_size?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          workshop_name: string
        }
        Update: {
          activated_at?: string | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          contacted_at?: string | null
          created_at?: string
          current_tool?: string | null
          demo_at?: string | null
          email?: string | null
          id?: string
          lost_reason?: string | null
          notes?: string | null
          phone?: string
          source?: string | null
          status?: string
          team_size?: string | null
          updated_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          workshop_name?: string
        }
        Relationships: []
      }
      plan_country_prices: {
        Row: {
          active: boolean
          amount: number
          country_code: string
          created_at: string
          currency: string
          cycle: string
          id: string
          plan_slug: string
          stripe_coupon_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days_override: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount?: number
          country_code: string
          created_at?: string
          currency: string
          cycle: string
          id?: string
          plan_slug: string
          stripe_coupon_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days_override?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          country_code?: string
          created_at?: string
          currency?: string
          cycle?: string
          id?: string
          plan_slug?: string
          stripe_coupon_id?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          trial_days_override?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_country_prices_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_country_prices_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_country_prices_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "plan_country_prices_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans_public"
            referencedColumns: ["slug"]
          },
        ]
      }
      plan_features: {
        Row: {
          enabled: boolean
          feature_slug: string
          id: string
          limits: Json
          plan_slug: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_slug: string
          id?: string
          limits?: Json
          plan_slug: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_slug?: string
          id?: string
          limits?: Json
          plan_slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_features_feature_slug_fkey"
            columns: ["feature_slug"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["slug"]
          },
        ]
      }
      plan_limits_catalog: {
        Row: {
          allow_unlimited: boolean
          category: string
          created_at: string
          description: string | null
          key: string
          label: string
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          allow_unlimited?: boolean
          category?: string
          created_at?: string
          description?: string | null
          key: string
          label: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          allow_unlimited?: boolean
          category?: string
          created_at?: string
          description?: string | null
          key?: string
          label?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      plan_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          country_code: string
          currency: string
          cycle: string
          id: string
          new_amount: number
          new_stripe_price_id: string
          notes: string | null
          old_amount: number | null
          old_stripe_price_id: string | null
          plan: string
          stripe_product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          country_code: string
          currency: string
          cycle: string
          id?: string
          new_amount: number
          new_stripe_price_id: string
          notes?: string | null
          old_amount?: number | null
          old_stripe_price_id?: string | null
          plan: string
          stripe_product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          country_code?: string
          currency?: string
          cycle?: string
          id?: string
          new_amount?: number
          new_stripe_price_id?: string
          notes?: string | null
          old_amount?: number | null
          old_stripe_price_id?: string | null
          plan?: string
          stripe_product_id?: string
        }
        Relationships: []
      }
      plan_promotions: {
        Row: {
          active: boolean
          country_code: string
          created_at: string
          created_by: string | null
          currency: string
          cycle: string
          ends_at: string | null
          id: string
          notes: string | null
          plan: string
          promo_price: number
          starts_at: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          country_code: string
          created_at?: string
          created_by?: string | null
          currency: string
          cycle: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          plan: string
          promo_price: number
          starts_at?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          country_code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          cycle?: string
          ends_at?: string | null
          id?: string
          notes?: string | null
          plan?: string
          promo_price?: number
          starts_at?: string | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean
          archived_at: string | null
          badge_label: string | null
          color: string | null
          created_at: string
          cta_label: string | null
          cta_mode: string
          cta_url: string | null
          description: string | null
          icon: string | null
          included_shops: number
          label: string | null
          limits: Json
          name: string
          show_badge: boolean
          show_button: boolean
          show_price: boolean
          show_trial: boolean
          slug: string
          sort_order: number
          stripe_product_id: string | null
          supports_multi_shop: boolean
          trial_days: number | null
          updated_at: string
          visible_on_billing: boolean
          visible_on_checkout: boolean
          visible_on_compare: boolean
          visible_on_landing: boolean
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          badge_label?: string | null
          color?: string | null
          created_at?: string
          cta_label?: string | null
          cta_mode?: string
          cta_url?: string | null
          description?: string | null
          icon?: string | null
          included_shops?: number
          label?: string | null
          limits?: Json
          name: string
          show_badge?: boolean
          show_button?: boolean
          show_price?: boolean
          show_trial?: boolean
          slug: string
          sort_order?: number
          stripe_product_id?: string | null
          supports_multi_shop?: boolean
          trial_days?: number | null
          updated_at?: string
          visible_on_billing?: boolean
          visible_on_checkout?: boolean
          visible_on_compare?: boolean
          visible_on_landing?: boolean
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          badge_label?: string | null
          color?: string | null
          created_at?: string
          cta_label?: string | null
          cta_mode?: string
          cta_url?: string | null
          description?: string | null
          icon?: string | null
          included_shops?: number
          label?: string | null
          limits?: Json
          name?: string
          show_badge?: boolean
          show_button?: boolean
          show_price?: boolean
          show_trial?: boolean
          slug?: string
          sort_order?: number
          stripe_product_id?: string | null
          supports_multi_shop?: boolean
          trial_days?: number | null
          updated_at?: string
          visible_on_billing?: boolean
          visible_on_checkout?: boolean
          visible_on_compare?: boolean
          visible_on_landing?: boolean
        }
        Relationships: []
      }
      platform_company_info: {
        Row: {
          accountant_email: string | null
          accountant_name: string | null
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          iban: string | null
          id: string
          legal_name: string
          notes: string | null
          postal_code: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          accountant_email?: string | null
          accountant_name?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          accountant_email?: string | null
          accountant_name?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          iban?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          postal_code?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
          labor_hours: number
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
          labor_hours?: number
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
          labor_hours?: number
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
      rate_limits: {
        Row: {
          action_type: string
          count: number
          created_at: string
          id: string
          identifier: string
          window_start: string
        }
        Insert: {
          action_type: string
          count?: number
          created_at?: string
          id?: string
          identifier: string
          window_start?: string
        }
        Update: {
          action_type?: string
          count?: number
          created_at?: string
          id?: string
          identifier?: string
          window_start?: string
        }
        Relationships: []
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
          {
            foreignKeyName: "regional_admin_countries_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
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
      seller_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string | null
          rating: number
          reviewer_id: string
          seller_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating: number
          reviewer_id: string
          seller_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          rating?: number
          reviewer_id?: string
          seller_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      seo_blog_posts: {
        Row: {
          author: string | null
          category: string
          content: string
          created_at: string
          excerpt: string | null
          id: string
          keyword: string | null
          meta_description: string | null
          meta_title: string | null
          og_image: string | null
          published_at: string | null
          reading_minutes: number
          scheduled_at: string | null
          slug: string
          source: string
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          keyword?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          scheduled_at?: string | null
          slug: string
          source?: string
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author?: string | null
          category?: string
          content?: string
          created_at?: string
          excerpt?: string | null
          id?: string
          keyword?: string | null
          meta_description?: string | null
          meta_title?: string | null
          og_image?: string | null
          published_at?: string | null
          reading_minutes?: number
          scheduled_at?: string | null
          slug?: string
          source?: string
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: []
      }
      seo_conversions: {
        Row: {
          conversion_type: string | null
          created_at: string
          first_touch_source: string | null
          id: string
          landing_path: string | null
          last_touch_source: string | null
          session_id: string | null
          shop_id: string | null
          user_id: string | null
          utm_campaign: string | null
        }
        Insert: {
          conversion_type?: string | null
          created_at?: string
          first_touch_source?: string | null
          id?: string
          landing_path?: string | null
          last_touch_source?: string | null
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
        }
        Update: {
          conversion_type?: string | null
          created_at?: string
          first_touch_source?: string | null
          id?: string
          landing_path?: string | null
          last_touch_source?: string | null
          session_id?: string | null
          shop_id?: string | null
          user_id?: string | null
          utm_campaign?: string | null
        }
        Relationships: []
      }
      seo_graph_links: {
        Row: {
          created_at: string
          id: string
          link_type: string
          source_entity: string
          source_id: string
          target_entity: string
          target_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          id?: string
          link_type?: string
          source_entity: string
          source_id: string
          target_entity: string
          target_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          id?: string
          link_type?: string
          source_entity?: string
          source_id?: string
          target_entity?: string
          target_id?: string
          updated_at?: string
          weight?: number
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
          required_skill: string | null
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
          required_skill?: string | null
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
          required_skill?: string | null
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
          {
            foreignKeyName: "service_reminders_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      session_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event: string
          id: string
          ip: string | null
          shop_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event: string
          id?: string
          ip?: string | null
          shop_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event?: string
          id?: string
          ip?: string | null
          shop_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
      shop_user_profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          id: string
          must_reset_password: boolean
          name: string | null
          phone: string | null
          position: string | null
          shop_user_id: string
          skills: string[]
          suspended_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          must_reset_password?: boolean
          name?: string | null
          phone?: string | null
          position?: string | null
          shop_user_id: string
          skills?: string[]
          suspended_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          id?: string
          must_reset_password?: boolean
          name?: string | null
          phone?: string | null
          position?: string | null
          shop_user_id?: string
          skills?: string[]
          suspended_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_user_profiles_shop_user_id_fkey"
            columns: ["shop_user_id"]
            isOneToOne: true
            referencedRelation: "shop_users"
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
          group_owner_id: string
          health_score: number | null
          id: string
          is_carity_partner: boolean
          labor_rate: number
          language: string
          last_seen_at: string | null
          latitude: number | null
          logo_url: string | null
          longitude: number | null
          name: string
          nif: string | null
          opening_hours: Json
          phone: string
          primary_color: string | null
          slug: string | null
          status: string
          stripe_connect_account_id: string | null
          stripe_connect_charges_enabled: boolean
          stripe_connect_onboarded: boolean
          stripe_connect_payouts_enabled: boolean
          suspended_at: string | null
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
          group_owner_id: string
          health_score?: number | null
          id?: string
          is_carity_partner?: boolean
          labor_rate?: number
          language?: string
          last_seen_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          nif?: string | null
          opening_hours?: Json
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          suspended_at?: string | null
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
          group_owner_id?: string
          health_score?: number | null
          id?: string
          is_carity_partner?: boolean
          labor_rate?: number
          language?: string
          last_seen_at?: string | null
          latitude?: number | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          nif?: string | null
          opening_hours?: Json
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          stripe_connect_charges_enabled?: boolean
          stripe_connect_onboarded?: boolean
          stripe_connect_payouts_enabled?: boolean
          suspended_at?: string | null
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
          {
            foreignKeyName: "shops_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
            referencedColumns: ["code"]
          },
        ]
      }
      signup_attempts: {
        Row: {
          attempted_at: string
          blocked: boolean
          email: string | null
          id: string
          ip_address: string | null
          realm: string | null
        }
        Insert: {
          attempted_at?: string
          blocked?: boolean
          email?: string | null
          id?: string
          ip_address?: string | null
          realm?: string | null
        }
        Update: {
          attempted_at?: string
          blocked?: boolean
          email?: string | null
          id?: string
          ip_address?: string | null
          realm?: string | null
        }
        Relationships: []
      }
      sla_config: {
        Row: {
          active: boolean | null
          first_response_minutes: number
          id: string
          resolution_hours: number
          scope: string
          severity: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          first_response_minutes: number
          id?: string
          resolution_hours: number
          scope: string
          severity: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          first_response_minutes?: number
          id?: string
          resolution_hours?: number
          scope?: string
          severity?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      staff_absences: {
        Row: {
          created_at: string
          end_at: string
          id: string
          reason: string | null
          shop_id: string
          start_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          reason?: string | null
          shop_id: string
          start_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          reason?: string | null
          shop_id?: string
          start_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_absences_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
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
            foreignKeyName: "stock_movements_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts_public"
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
          {
            foreignKeyName: "stock_movements_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json | null
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload?: Json | null
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json | null
          processed_at?: string
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
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
      system_features: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string | null
          phone: string | null
          revoked_at: string | null
          role: string
          shop_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          name?: string | null
          phone?: string | null
          revoked_at?: string | null
          role: string
          shop_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          phone?: string | null
          revoked_at?: string | null
          role?: string
          shop_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
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
      user_activity: {
        Row: {
          last_seen_at: string
          last_shop_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          last_shop_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          last_shop_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      vehicle_trust_events: {
        Row: {
          created_at: string
          event_date: string
          event_type: string
          id: string
          km_reported: number | null
          plate: string | null
          reference_id: string | null
          reference_type: string | null
          shop_id: string | null
          source: string
          vehicle_id: string | null
          verified: boolean
          vin: string | null
        }
        Insert: {
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          km_reported?: number | null
          plate?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string | null
          source?: string
          vehicle_id?: string | null
          verified?: boolean
          vin?: string | null
        }
        Update: {
          created_at?: string
          event_date?: string
          event_type?: string
          id?: string
          km_reported?: number | null
          plate?: string | null
          reference_id?: string | null
          reference_type?: string | null
          shop_id?: string | null
          source?: string
          vehicle_id?: string | null
          verified?: boolean
          vin?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_trust_events_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
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
          {
            foreignKeyName: "warranties_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
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
          {
            foreignKeyName: "work_order_attachments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
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
          {
            foreignKeyName: "work_order_times_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders_public"
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
            foreignKeyName: "work_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes_public"
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
      workshop_productivity_daily: {
        Row: {
          active_technicians: number | null
          avg_repair_minutes: number | null
          completed_orders: number | null
          computed_at: string | null
          forecast_revenue_eur: number | null
          shop_id: string
          snapshot_date: string
          upcoming_workload: number | null
          utilization_rate: number | null
        }
        Insert: {
          active_technicians?: number | null
          avg_repair_minutes?: number | null
          completed_orders?: number | null
          computed_at?: string | null
          forecast_revenue_eur?: number | null
          shop_id: string
          snapshot_date: string
          upcoming_workload?: number | null
          utilization_rate?: number | null
        }
        Update: {
          active_technicians?: number | null
          avg_repair_minutes?: number | null
          completed_orders?: number | null
          computed_at?: string | null
          forecast_revenue_eur?: number | null
          shop_id?: string
          snapshot_date?: string
          upcoming_workload?: number | null
          utilization_rate?: number | null
        }
        Relationships: []
      }
      workshop_trust_scores: {
        Row: {
          approval_rate: number
          audited_failed: number
          avg_risk_score: number
          flagged_inspections: number
          last_recalculated_at: string
          level: string
          score: number
          shop_id: string
          total_inspections: number
        }
        Insert: {
          approval_rate?: number
          audited_failed?: number
          avg_risk_score?: number
          flagged_inspections?: number
          last_recalculated_at?: string
          level?: string
          score?: number
          shop_id: string
          total_inspections?: number
        }
        Update: {
          approval_rate?: number
          audited_failed?: number
          avg_risk_score?: number
          flagged_inspections?: number
          last_recalculated_at?: string
          level?: string
          score?: number
          shop_id?: string
          total_inspections?: number
        }
        Relationships: [
          {
            foreignKeyName: "workshop_trust_scores_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: true
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      carity_inspection_reports_public: {
        Row: {
          brakes_photos: Json | null
          brakes_status: string | null
          completed_at: string | null
          created_at: string | null
          damage_photos: Json | null
          defects: Json | null
          electrical_status: string | null
          engine_photos: Json | null
          engine_status: string | null
          exterior_photos: Json | null
          id: string | null
          inspection_city: string | null
          inspection_country: string | null
          inspection_id: string | null
          inspection_lat: number | null
          inspection_lng: number | null
          inspector_notes: string | null
          interior_photos: Json | null
          is_locked: boolean | null
          listing_id: string | null
          mileage_at_inspection: number | null
          overall_score: number | null
          recommendation: string | null
          shop_id: string | null
          steering_status: string | null
          suspension_photos: Json | null
          suspension_status: string | null
          technician_name: string | null
          tire_photos: Json | null
          tires_status: string | null
          transmission_status: string | null
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
      carity_seller_profiles_public: {
        Row: {
          account_type: string | null
          country_code: string | null
          created_at: string | null
          dealer_city: string | null
          dealer_company_name: string | null
          dealer_description: string | null
          dealer_logo_url: string | null
          dealer_slug: string | null
          id: string | null
          location: string | null
          name: string | null
          phone: string | null
          user_id: string | null
          verified: boolean | null
        }
        Insert: {
          account_type?: string | null
          country_code?: string | null
          created_at?: string | null
          dealer_city?: string | null
          dealer_company_name?: string | null
          dealer_description?: string | null
          dealer_logo_url?: string | null
          dealer_slug?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Update: {
          account_type?: string | null
          country_code?: string | null
          created_at?: string | null
          dealer_city?: string | null
          dealer_company_name?: string | null
          dealer_description?: string | null
          dealer_logo_url?: string | null
          dealer_slug?: string | null
          id?: string | null
          location?: string | null
          name?: string | null
          phone?: string | null
          user_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
            referencedColumns: ["code"]
          },
        ]
      }
      country_settings_public: {
        Row: {
          active: boolean | null
          code: string | null
          currency: string | null
          currency_symbol: string | null
          default_language: string | null
          flag_emoji: string | null
          inspection_platform_share: number | null
          inspection_price: number | null
          inspection_shop_share: number | null
          locale: string | null
          market_commission_rate: number | null
          name: string | null
          saas_free_monthly: number | null
          saas_free_yearly: number | null
          saas_garage_monthly: number | null
          saas_garage_yearly: number | null
          saas_pro_monthly: number | null
          saas_pro_yearly: number | null
          saas_trial_days: number | null
          supported_languages: string[] | null
          tax_label: string | null
          timezones: string[] | null
        }
        Insert: {
          active?: boolean | null
          code?: string | null
          currency?: string | null
          currency_symbol?: string | null
          default_language?: string | null
          flag_emoji?: string | null
          inspection_platform_share?: number | null
          inspection_price?: number | null
          inspection_shop_share?: number | null
          locale?: string | null
          market_commission_rate?: number | null
          name?: string | null
          saas_free_monthly?: number | null
          saas_free_yearly?: number | null
          saas_garage_monthly?: number | null
          saas_garage_yearly?: number | null
          saas_pro_monthly?: number | null
          saas_pro_yearly?: number | null
          saas_trial_days?: number | null
          supported_languages?: string[] | null
          tax_label?: string | null
          timezones?: string[] | null
        }
        Update: {
          active?: boolean | null
          code?: string | null
          currency?: string | null
          currency_symbol?: string | null
          default_language?: string | null
          flag_emoji?: string | null
          inspection_platform_share?: number | null
          inspection_price?: number | null
          inspection_shop_share?: number | null
          locale?: string | null
          market_commission_rate?: number | null
          name?: string | null
          saas_free_monthly?: number | null
          saas_free_yearly?: number | null
          saas_garage_monthly?: number | null
          saas_garage_yearly?: number | null
          saas_pro_monthly?: number | null
          saas_pro_yearly?: number | null
          saas_trial_days?: number | null
          supported_languages?: string[] | null
          tax_label?: string | null
          timezones?: string[] | null
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "carity_seller_profiles_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
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
      parts_public: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string | null
          min_stock: number | null
          name: string | null
          reference: string | null
          sale_price: number | null
          shop_id: string | null
          stock_quantity: number | null
          supplier: string | null
          vat_rate: number | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string | null
          min_stock?: number | null
          name?: string | null
          reference?: string | null
          sale_price?: number | null
          shop_id?: string | null
          stock_quantity?: number | null
          supplier?: string | null
          vat_rate?: number | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string | null
          min_stock?: number | null
          name?: string | null
          reference?: string | null
          sale_price?: number | null
          shop_id?: string | null
          stock_quantity?: number | null
          supplier?: string | null
          vat_rate?: number | null
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
      plan_country_prices_public: {
        Row: {
          active: boolean | null
          amount: number | null
          country_code: string | null
          created_at: string | null
          currency: string | null
          cycle: string | null
          id: string | null
          plan_slug: string | null
          trial_days_override: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          amount?: number | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          cycle?: string | null
          id?: string | null
          plan_slug?: string | null
          trial_days_override?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          amount?: number | null
          country_code?: string | null
          created_at?: string | null
          currency?: string | null
          cycle?: string | null
          id?: string | null
          plan_slug?: string | null
          trial_days_override?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_country_prices_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_country_prices_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "country_settings_public"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "plan_country_prices_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "plan_country_prices_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans_public"
            referencedColumns: ["slug"]
          },
        ]
      }
      plans_public: {
        Row: {
          active: boolean | null
          archived_at: string | null
          badge_label: string | null
          color: string | null
          created_at: string | null
          cta_label: string | null
          cta_mode: string | null
          cta_url: string | null
          description: string | null
          icon: string | null
          included_shops: number | null
          label: string | null
          limits: Json | null
          name: string | null
          show_badge: boolean | null
          show_button: boolean | null
          show_price: boolean | null
          show_trial: boolean | null
          slug: string | null
          sort_order: number | null
          supports_multi_shop: boolean | null
          trial_days: number | null
          updated_at: string | null
          visible_on_billing: boolean | null
          visible_on_checkout: boolean | null
          visible_on_compare: boolean | null
          visible_on_landing: boolean | null
        }
        Insert: {
          active?: boolean | null
          archived_at?: string | null
          badge_label?: string | null
          color?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_mode?: string | null
          cta_url?: string | null
          description?: string | null
          icon?: string | null
          included_shops?: number | null
          label?: string | null
          limits?: Json | null
          name?: string | null
          show_badge?: boolean | null
          show_button?: boolean | null
          show_price?: boolean | null
          show_trial?: boolean | null
          slug?: string | null
          sort_order?: number | null
          supports_multi_shop?: boolean | null
          trial_days?: number | null
          updated_at?: string | null
          visible_on_billing?: boolean | null
          visible_on_checkout?: boolean | null
          visible_on_compare?: boolean | null
          visible_on_landing?: boolean | null
        }
        Update: {
          active?: boolean | null
          archived_at?: string | null
          badge_label?: string | null
          color?: string | null
          created_at?: string | null
          cta_label?: string | null
          cta_mode?: string | null
          cta_url?: string | null
          description?: string | null
          icon?: string | null
          included_shops?: number | null
          label?: string | null
          limits?: Json | null
          name?: string | null
          show_badge?: boolean | null
          show_button?: boolean | null
          show_price?: boolean | null
          show_trial?: boolean | null
          slug?: string | null
          sort_order?: number | null
          supports_multi_shop?: boolean | null
          trial_days?: number | null
          updated_at?: string | null
          visible_on_billing?: boolean | null
          visible_on_checkout?: boolean | null
          visible_on_compare?: boolean | null
          visible_on_landing?: boolean | null
        }
        Relationships: []
      }
      quotes_public: {
        Row: {
          client_id: string | null
          client_notes: string | null
          created_at: string | null
          date: string | null
          id: string | null
          labor_hours: number | null
          lines: Json | null
          notes: string | null
          number: string | null
          shop_id: string | null
          signature_data: string | null
          signature_hash: string | null
          signed_at: string | null
          signer_name: string | null
          status: string | null
          subtotal: number | null
          token: string | null
          total: number | null
          validity_date: string | null
          vat_total: number | null
          vehicle_id: string | null
        }
        Insert: {
          client_id?: string | null
          client_notes?: string | null
          created_at?: string | null
          date?: string | null
          id?: string | null
          labor_hours?: number | null
          lines?: Json | null
          notes?: string | null
          number?: string | null
          shop_id?: string | null
          signature_data?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string | null
          subtotal?: number | null
          token?: string | null
          total?: number | null
          validity_date?: string | null
          vat_total?: number | null
          vehicle_id?: string | null
        }
        Update: {
          client_id?: string | null
          client_notes?: string | null
          created_at?: string | null
          date?: string | null
          id?: string | null
          labor_hours?: number | null
          lines?: Json | null
          notes?: string | null
          number?: string | null
          shop_id?: string | null
          signature_data?: string | null
          signature_hash?: string | null
          signed_at?: string | null
          signer_name?: string | null
          status?: string | null
          subtotal?: number | null
          token?: string | null
          total?: number | null
          validity_date?: string | null
          vat_total?: number | null
          vehicle_id?: string | null
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
      work_orders_public: {
        Row: {
          client_description: string | null
          client_id: string | null
          created_at: string | null
          diagnosis: string | null
          entry_mileage: number | null
          id: string | null
          number: string | null
          origin: string | null
          quote_id: string | null
          shop_id: string | null
          status: string | null
          vehicle_id: string | null
        }
        Insert: {
          client_description?: string | null
          client_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          entry_mileage?: number | null
          id?: string | null
          number?: string | null
          origin?: string | null
          quote_id?: string | null
          shop_id?: string | null
          status?: string | null
          vehicle_id?: string | null
        }
        Update: {
          client_description?: string | null
          client_id?: string | null
          created_at?: string | null
          diagnosis?: string | null
          entry_mileage?: number | null
          id?: string | null
          number?: string | null
          origin?: string | null
          quote_id?: string | null
          shop_id?: string | null
          status?: string | null
          vehicle_id?: string | null
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
            foreignKeyName: "work_orders_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes_public"
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
    Functions: {
      _ai_check_rate_limit: {
        Args: { _limit: number; _subject_id: string; _subject_type: string }
        Returns: boolean
      }
      _ai_setting_numeric: {
        Args: { _default: number; _key: string }
        Returns: number
      }
      accept_team_invitation: {
        Args: { _token: string }
        Returns: {
          role: string
          shop_id: string
        }[]
      }
      activate_marketplace_for_shop: {
        Args: { _shop_id: string }
        Returns: Json
      }
      admin_force_logout: {
        Args: { _shop_id: string; _target_user_id: string }
        Returns: boolean
      }
      admin_get_promotion: {
        Args: { p_country_code: string; p_cycle: string; p_plan: string }
        Returns: {
          active: boolean
          ends_at: string
          promo_price: number
          starts_at: string
          stripe_price_id: string
        }[]
      }
      admin_list_country_settings: {
        Args: never
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
          saas_free_monthly: number
          saas_free_yearly: number
          saas_garage_monthly: number
          saas_garage_yearly: number
          saas_pro_monthly: number
          saas_pro_yearly: number
          saas_trial_days: number
          stripe_free_monthly: string | null
          stripe_free_product_id: string | null
          stripe_free_yearly: string | null
          stripe_garage_monthly: string | null
          stripe_garage_product_id: string | null
          stripe_garage_yearly: string | null
          stripe_pro_monthly: string | null
          stripe_pro_product_id: string | null
          stripe_pro_yearly: string | null
          supported_languages: string[]
          tax_label: string
          timezones: string[]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "country_settings"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_plan_country_prices: {
        Args: never
        Returns: {
          active: boolean
          amount: number
          country_code: string
          created_at: string
          currency: string
          cycle: string
          id: string
          plan_slug: string
          stripe_coupon_id: string | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          trial_days_override: number | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "plan_country_prices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_list_risk_inspections: {
        Args: { _filter?: string; _limit?: number }
        Returns: {
          audit_status: string
          completed_at: string
          id: string
          listing_id: string
          overall_score: number
          recommendation: string
          risk_flags: Json
          risk_level: string
          risk_score: number
          shop_id: string
          shop_name: string
          technician_name: string
        }[]
      }
      admin_require_password_reset: {
        Args: { _shop_id: string; _target_user_id: string }
        Returns: boolean
      }
      admin_set_audit_status: {
        Args: { _new_status: string; _report_id: string }
        Returns: undefined
      }
      ai_log_cache_hit: {
        Args: { _function_name: string; _prompt_hash: string; _shop_id: string }
        Returns: undefined
      }
      ai_save_cache: {
        Args: {
          _cache_key: string
          _function_name: string
          _response: Json
          _shop_id: string
          _ttl_seconds?: number
        }
        Returns: undefined
      }
      ai_try_cache: { Args: { _cache_key: string }; Returns: Json }
      archive_old_events: { Args: { _days?: number }; Returns: Json }
      calculate_inspection_risk: {
        Args: { _report_id: string }
        Returns: undefined
      }
      calculate_opportunity_score: {
        Args: { _entity_id: string; _entity_type: string }
        Returns: Json
      }
      cascade_delete_shop: { Args: { _shop_id: string }; Returns: undefined }
      check_and_bump_rate_limit: {
        Args: {
          _action: string
          _identifier: string
          _max: number
          _window_seconds: number
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          _action_type: string
          _identifier: string
          _max_count?: number
          _window_seconds?: number
        }
        Returns: Json
      }
      check_shop_creation_limit: {
        Args: { _user_id: string }
        Returns: boolean
      }
      check_signup_rate_limit: {
        Args: { _email: string; _ip: string }
        Returns: Json
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
      claim_next_actions: {
        Args: { _limit?: number }
        Returns: {
          action_type: string
          attempts: number
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          last_error: string | null
          max_attempts: number
          payload: Json
          scheduled_at: string
          status: string
          trace_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "action_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_action: {
        Args: { _error?: string; _id: string; _success: boolean }
        Returns: undefined
      }
      compute_business_metrics_snapshot: { Args: never; Returns: Json }
      compute_customer_health: { Args: never; Returns: Json }
      consume_ai_credit: {
        Args: {
          _cost?: number
          _function_name: string
          _metadata?: Json
          _shop_id: string
        }
        Returns: Json
      }
      consume_platform_ai_credit: {
        Args: { _cost?: number; _function_name: string; _metadata?: Json }
        Returns: Json
      }
      create_team_invitation: {
        Args: {
          _email: string
          _name?: string
          _phone?: string
          _role: string
          _shop_id: string
        }
        Returns: {
          invitation_id: string
          token: string
        }[]
      }
      current_shop_role: { Args: { _shop_id: string }; Returns: string }
      dealer_can_publish: { Args: { _user_id: string }; Returns: Json }
      dealer_nif_available: { Args: { _nif: string }; Returns: boolean }
      delete_child_shop: { Args: { _shop_id: string }; Returns: Json }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      detect_anomaly: {
        Args: {
          _anomaly_type: string
          _description?: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _severity?: string
        }
        Returns: string
      }
      detect_workshop_anomalies: { Args: never; Returns: Json }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enforce_rate_limit: {
        Args: {
          _action_type: string
          _identifier: string
          _max?: number
          _window_seconds?: number
        }
        Returns: undefined
      }
      enqueue_action: {
        Args: {
          _action_type: string
          _entity_id: string
          _entity_type: string
          _payload?: Json
          _scheduled_at?: string
          _trace_id?: string
        }
        Returns: string
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      enroll_shop_in_market: { Args: { _shop_id: string }; Returns: Json }
      flag_suspicious_transactions: { Args: never; Returns: Json }
      generate_recommended_actions: {
        Args: { _entity_type: string; _metadata?: Json; _score: number }
        Returns: Json
      }
      generate_report_hash: { Args: { _report_id: string }; Returns: string }
      get_active_promotion: {
        Args: { _country_code: string; _cycle: string; _plan: string }
        Returns: {
          discount_percent: number
          ends_at: string
          promo_price: number
          stripe_price_id: string
        }[]
      }
      get_admin_countries: { Args: { _user_id: string }; Returns: string[] }
      get_ai_admin_stats: { Args: never; Returns: Json }
      get_ai_global_status: { Args: never; Returns: Json }
      get_ai_usage: { Args: { _shop_id: string }; Returns: Json }
      get_client_portal_data: { Args: { _token: string }; Returns: Json }
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
          saas_free_monthly: number
          saas_free_yearly: number
          saas_garage_monthly: number
          saas_garage_yearly: number
          saas_pro_monthly: number
          saas_pro_yearly: number
          saas_trial_days: number
          stripe_free_monthly: string | null
          stripe_free_product_id: string | null
          stripe_free_yearly: string | null
          stripe_garage_monthly: string | null
          stripe_garage_product_id: string | null
          stripe_garage_yearly: string | null
          stripe_pro_monthly: string | null
          stripe_pro_product_id: string | null
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
      get_default_plan_slug: { Args: never; Returns: string }
      get_effective_plan_price: {
        Args: { p_country_code: string; p_cycle: string; p_plan_slug: string }
        Returns: {
          base_amount: number
          base_stripe_price_id: string
          base_stripe_product_id: string
          country_code: string
          currency: string
          cycle: string
          discount_percent: number
          effective_amount: number
          effective_stripe_price_id: string
          plan_slug: string
          promo_active: boolean
          promo_ends_at: string
          promo_starts_at: string
        }[]
      }
      get_inspection_verification_token: {
        Args: { _report_id: string }
        Returns: string
      }
      get_my_supplier_id: { Args: never; Returns: string }
      get_public_shop_by_slug: { Args: { _slug: string }; Returns: Json }
      get_quote_by_token: { Args: { _token: string }; Returns: Json }
      get_seller_emails: {
        Args: { seller_ids: string[] }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_shop_country_code: { Args: { shop_id: string }; Returns: string }
      get_shop_creation_status: { Args: { _user_id: string }; Returns: Json }
      get_shop_member_emails: {
        Args: { _shop_id: string }
        Returns: {
          email: string
          user_id: string
        }[]
      }
      get_team_invitation_info: {
        Args: { _token: string }
        Returns: {
          accepted_at: string
          email: string
          expires_at: string
          name: string
          phone: string
          revoked_at: string
          role: string
          shop_id: string
          shop_name: string
          valid: boolean
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
      gsn_accept_invite: { Args: { _token: string }; Returns: string }
      gsn_approve_application: {
        Args: { _app_id: string; _commission?: number; _owner_user_id: string }
        Returns: string
      }
      gsn_cart_add: {
        Args: { _product_id: string; _quantity?: number; _shop_id: string }
        Returns: string
      }
      gsn_cart_checkout: { Args: { _shop_id: string }; Returns: string[] }
      gsn_cart_ensure: { Args: { _shop_id: string }; Returns: string }
      gsn_complaint_create: {
        Args: { _body: string; _order_id: string; _subject: string }
        Returns: string
      }
      gsn_current_supplier_state: {
        Args: never
        Returns: {
          company_name: string
          rejection_reason: string
          state: Database["public"]["Enums"]["gsn_supplier_state"]
          supplier_id: string
        }[]
      }
      gsn_order_transition: {
        Args: { _note?: string; _order_id: string; _to: string }
        Returns: undefined
      }
      gsn_reject_application: {
        Args: { _app_id: string; _reason: string }
        Returns: undefined
      }
      gsn_search_products: {
        Args: {
          _brand?: string
          _category?: string
          _in_stock?: boolean
          _limit?: number
          _max_price?: number
          _min_price?: number
          _offset?: number
          _q?: string
          _supplier_id?: string
        }
        Returns: {
          brand: string | null
          category: string | null
          compatibility: Json
          condition: Database["public"]["Enums"]["gsn_product_condition"]
          created_at: string
          currency: string
          datasheet: string | null
          deleted_at: string | null
          description: string | null
          discount_price: number | null
          ean: string | null
          gallery: Json
          height: number | null
          id: string
          image: string | null
          length: number | null
          manual_pdf: string | null
          manufacturer_reference: string | null
          model: string | null
          price: number
          reserved_stock: number
          sku: string | null
          status: Database["public"]["Enums"]["gsn_product_status"]
          stock: number
          subcategory: string | null
          supplier_id: string
          technical_description: string | null
          title: string
          updated_at: string
          vat: number
          weight: number | null
          width: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "gsn_products"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      gsn_supplier_is_approved: { Args: { _uid: string }; Returns: boolean }
      has_capability: {
        Args: { _cap: string; _shop_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_commercial_admin: { Args: { _user_id?: string }; Returns: boolean }
      is_group_owner: { Args: { _shop_id: string }; Returns: boolean }
      is_regional_admin_for: {
        Args: { _country_code: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_shop_payout_paid: {
        Args: { _payout_id: string; _reference?: string }
        Returns: undefined
      }
      market_vehicle_trust_check: {
        Args: { _km_listing?: number; _plate?: string; _vin?: string }
        Returns: Json
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_invoice_number: { Args: { _shop_id: string }; Returns: string }
      next_number: {
        Args: { _prefix: string; _shop_id: string }
        Returns: string
      }
      plan_has_feature: {
        Args: { _feature: string; _plan: string }
        Returns: boolean
      }
      purge_old_rate_limits: { Args: never; Returns: undefined }
      purge_old_signup_attempts: { Args: never; Returns: undefined }
      purge_old_stripe_webhook_events: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_all_growth_opportunities: { Args: never; Returns: Json }
      recalculate_trust_score: {
        Args: { _seller_id: string }
        Returns: undefined
      }
      recalculate_workshop_trust: {
        Args: { _shop_id: string }
        Returns: undefined
      }
      reconcile_entity_state: { Args: { _limit?: number }; Returns: Json }
      record_funnel_event: {
        Args: {
          _entity_id: string
          _entity_type: string
          _metadata?: Json
          _source_event?: string
          _stage: string
          _user_id?: string
        }
        Returns: string
      }
      redeem_coupon: {
        Args: { _code: string; _shop_id: string }
        Returns: Json
      }
      refresh_email_campaign_metrics: {
        Args: { _campaign_id: string }
        Returns: undefined
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
      respond_to_quote_by_token: {
        Args: {
          _action: string
          _client_notes?: string
          _signature_data?: string
          _signature_hash?: string
          _signer_name?: string
          _token: string
        }
        Returns: Json
      }
      retry_failed_jobs: { Args: { _limit?: number }; Returns: number }
      review_marketplace_activation: {
        Args: { _approve: boolean; _notes?: string; _request_id: string }
        Returns: Json
      }
      seed_email_templates_for_shop: {
        Args: { _shop_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      touch_user_activity: { Args: { _shop_id?: string }; Returns: undefined }
      track_event: {
        Args: {
          _event_name: string
          _payload?: Json
          _session_id?: string
          _shop_id?: string
        }
        Returns: string
      }
      transfer_shop_user: {
        Args: { _from_shop_id: string; _to_shop_id: string; _user_id: string }
        Returns: Json
      }
      update_landing_visit_engagement: {
        Args: { _scroll: number; _session_id: string; _time: number }
        Returns: undefined
      }
      upsert_entity_state: {
        Args: {
          _conversion_score?: number
          _entity_id: string
          _entity_type: string
          _health_score?: number
          _last_activity_at?: string
          _lifecycle_state?: string
        }
        Returns: string
      }
      user_best_plan: { Args: { _user_id: string }; Returns: string }
      user_can_use_feature: {
        Args: { _feature: string; _user_id: string }
        Returns: boolean
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
      verify_inspection_certificate: { Args: { _token: string }; Returns: Json }
    }
    Enums: {
      app_role:
        | "buyer"
        | "seller"
        | "garage_owner"
        | "admin"
        | "regional_admin"
        | "super_admin"
        | "commercial_admin"
        | "supplier"
      gsn_notification_kind:
        | "order_new"
        | "order_status"
        | "payment_new"
        | "tracking_new"
        | "low_stock"
        | "product_approved"
        | "supplier_approved"
        | "promo"
        | "review_new"
        | "complaint_new"
      gsn_order_state:
        | "cart"
        | "pending"
        | "paid"
        | "confirmed"
        | "preparing"
        | "shipped"
        | "partial"
        | "delivered"
        | "cancelled"
        | "refunded"
      gsn_payment_state:
        | "pending"
        | "authorized"
        | "captured"
        | "failed"
        | "refunded"
      gsn_product_condition: "new" | "refurbished" | "used"
      gsn_product_status: "draft" | "active" | "archived"
      gsn_stock_move_type:
        | "in"
        | "out"
        | "reserve"
        | "release"
        | "adjust"
        | "inventory"
      gsn_supplier_state:
        | "invited"
        | "pending"
        | "pending_approval"
        | "approved"
        | "rejected"
        | "suspended"
        | "blocked"
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
        "buyer",
        "seller",
        "garage_owner",
        "admin",
        "regional_admin",
        "super_admin",
        "commercial_admin",
        "supplier",
      ],
      gsn_notification_kind: [
        "order_new",
        "order_status",
        "payment_new",
        "tracking_new",
        "low_stock",
        "product_approved",
        "supplier_approved",
        "promo",
        "review_new",
        "complaint_new",
      ],
      gsn_order_state: [
        "cart",
        "pending",
        "paid",
        "confirmed",
        "preparing",
        "shipped",
        "partial",
        "delivered",
        "cancelled",
        "refunded",
      ],
      gsn_payment_state: [
        "pending",
        "authorized",
        "captured",
        "failed",
        "refunded",
      ],
      gsn_product_condition: ["new", "refurbished", "used"],
      gsn_product_status: ["draft", "active", "archived"],
      gsn_stock_move_type: [
        "in",
        "out",
        "reserve",
        "release",
        "adjust",
        "inventory",
      ],
      gsn_supplier_state: [
        "invited",
        "pending",
        "pending_approval",
        "approved",
        "rejected",
        "suspended",
        "blocked",
      ],
    },
  },
} as const
