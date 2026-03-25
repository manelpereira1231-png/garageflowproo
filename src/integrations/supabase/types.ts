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
      shops: {
        Row: {
          address: string | null
          country: string
          created_at: string
          currency: string
          email: string
          id: string
          labor_rate: number
          language: string
          logo_url: string | null
          name: string
          nif: string | null
          phone: string
          primary_color: string | null
          slug: string | null
          status: string
          timezone: string
          user_id: string
          vat_rate: number
        }
        Insert: {
          address?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          labor_rate?: number
          language?: string
          logo_url?: string | null
          name?: string
          nif?: string | null
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          timezone?: string
          user_id: string
          vat_rate?: number
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          currency?: string
          email?: string
          id?: string
          labor_rate?: number
          language?: string
          logo_url?: string | null
          name?: string
          nif?: string | null
          phone?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
          timezone?: string
          user_id?: string
          vat_rate?: number
        }
        Relationships: []
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
          id: string
          plan: string
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
          id?: string
          plan?: string
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
          id?: string
          plan?: string
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
      [_ in never]: never
    }
    Functions: {
      cascade_delete_shop: { Args: { _shop_id: string }; Returns: undefined }
      check_shop_creation_limit: {
        Args: { _user_id: string }
        Returns: boolean
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
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      next_invoice_number: { Args: { _shop_id: string }; Returns: string }
      next_number: {
        Args: { _prefix: string; _shop_id: string }
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
      validate_plan_limit: {
        Args: { _action_type: string; _shop_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
