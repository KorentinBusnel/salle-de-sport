export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      accounting_entries: {
        Row: {
          amount_cents: number;
          category: string | null;
          currency: string;
          entry_date: string;
          external_id: string;
          gym_id: string;
          id: string;
          kind: string;
          label: string | null;
          raw: Json | null;
          synced_at: string;
        };
        Insert: {
          amount_cents: number;
          category?: string | null;
          currency?: string;
          entry_date: string;
          external_id: string;
          gym_id: string;
          id?: string;
          kind: string;
          label?: string | null;
          raw?: Json | null;
          synced_at?: string;
        };
        Update: {
          amount_cents?: number;
          category?: string | null;
          currency?: string;
          entry_date?: string;
          external_id?: string;
          gym_id?: string;
          id?: string;
          kind?: string;
          label?: string | null;
          raw?: Json | null;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounting_entries_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          created_at: string;
          gym_id: string;
          id: string;
          profile_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          gym_id: string;
          id?: string;
          profile_id: string;
          title?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          gym_id?: string;
          id?: string;
          profile_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: NonNullable<Json>;
          conversation_id: string;
          created_at: string;
          gym_id: string;
          id: string;
          role: string;
        };
        Insert: {
          content: NonNullable<Json>;
          conversation_id: string;
          created_at?: string;
          gym_id: string;
          id?: string;
          role: string;
        };
        Update: {
          content?: NonNullable<Json>;
          conversation_id?: string;
          created_at?: string;
          gym_id?: string;
          id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_gym_id_fkey";
            columns: ["conversation_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      audit_log: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          details: NonNullable<Json>;
          entity: string | null;
          entity_id: string | null;
          gym_id: string | null;
          id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string | null;
          entity_id?: string | null;
          gym_id?: string | null;
          id?: never;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          details?: NonNullable<Json>;
          entity?: string | null;
          entity_id?: string | null;
          gym_id?: string | null;
          id?: never;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_log_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      automations: {
        Row: {
          created_at: string;
          enabled: boolean;
          gym_id: string;
          id: string;
          kind: Database["public"]["Enums"]["automation_kind"];
          last_run_at: string | null;
          params: NonNullable<Json>;
          template_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          gym_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["automation_kind"];
          last_run_at?: string | null;
          params?: NonNullable<Json>;
          template_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          gym_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["automation_kind"];
          last_run_at?: string | null;
          params?: NonNullable<Json>;
          template_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "automations_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "automations_template_id_gym_id_fkey";
            columns: ["template_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "email_templates";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      bookings: {
        Row: {
          booked_at: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          gym_id: string;
          id: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          waitlist_position: number | null;
        };
        Insert: {
          booked_at?: string;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
          gym_id: string;
          id?: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          waitlist_position?: number | null;
        };
        Update: {
          booked_at?: string;
          cancelled_at?: string | null;
          checked_in_at?: string | null;
          created_at?: string;
          gym_id?: string;
          id?: string;
          member_id?: string;
          session_id?: string;
          status?: Database["public"]["Enums"]["booking_status"];
          updated_at?: string;
          waitlist_position?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "bookings_session_id_gym_id_fkey";
            columns: ["session_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["campaign_channel"];
          content: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          gym_id: string;
          id: string;
          name: string;
          scheduled_at: string | null;
          segment: NonNullable<Json>;
          sent_at: string | null;
          stats: NonNullable<Json>;
          status: Database["public"]["Enums"]["campaign_status"];
          updated_at: string;
        };
        Insert: {
          channel: Database["public"]["Enums"]["campaign_channel"];
          content?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          gym_id: string;
          id?: string;
          name: string;
          scheduled_at?: string | null;
          segment?: NonNullable<Json>;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["campaign_status"];
          updated_at?: string;
        };
        Update: {
          channel?: Database["public"]["Enums"]["campaign_channel"];
          content?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          gym_id?: string;
          id?: string;
          name?: string;
          scheduled_at?: string | null;
          segment?: NonNullable<Json>;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["campaign_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      class_sessions: {
        Row: {
          booked_count: number;
          cancellation_reason: string | null;
          capacity: number;
          coach_id: string | null;
          created_at: string;
          discipline_id: string;
          ends_at: string;
          gym_id: string;
          id: string;
          is_customized: boolean;
          room_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["session_status"];
          template_id: string | null;
          updated_at: string;
          waitlist_count: number;
        };
        Insert: {
          booked_count?: number;
          cancellation_reason?: string | null;
          capacity: number;
          coach_id?: string | null;
          created_at?: string;
          discipline_id: string;
          ends_at: string;
          gym_id: string;
          id?: string;
          is_customized?: boolean;
          room_id?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["session_status"];
          template_id?: string | null;
          updated_at?: string;
          waitlist_count?: number;
        };
        Update: {
          booked_count?: number;
          cancellation_reason?: string | null;
          capacity?: number;
          coach_id?: string | null;
          created_at?: string;
          discipline_id?: string;
          ends_at?: string;
          gym_id?: string;
          id?: string;
          is_customized?: boolean;
          room_id?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["session_status"];
          template_id?: string | null;
          updated_at?: string;
          waitlist_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "class_sessions_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "class_sessions_discipline_id_gym_id_fkey";
            columns: ["discipline_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "disciplines";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "class_sessions_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_room_id_gym_id_fkey";
            columns: ["room_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "class_sessions_template_id_gym_id_fkey";
            columns: ["template_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "class_templates";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      class_templates: {
        Row: {
          capacity: number;
          created_at: string;
          default_coach_id: string | null;
          discipline_id: string;
          duration_minutes: number;
          ends_on: string | null;
          gym_id: string;
          id: string;
          is_active: boolean;
          room_id: string | null;
          start_time: string;
          starts_on: string;
          updated_at: string;
          weekday: number;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          default_coach_id?: string | null;
          discipline_id: string;
          duration_minutes: number;
          ends_on?: string | null;
          gym_id: string;
          id?: string;
          is_active?: boolean;
          room_id?: string | null;
          start_time: string;
          starts_on?: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          default_coach_id?: string | null;
          discipline_id?: string;
          duration_minutes?: number;
          ends_on?: string | null;
          gym_id?: string;
          id?: string;
          is_active?: boolean;
          room_id?: string | null;
          start_time?: string;
          starts_on?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "class_templates_default_coach_id_gym_id_fkey";
            columns: ["default_coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "class_templates_discipline_id_gym_id_fkey";
            columns: ["discipline_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "disciplines";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "class_templates_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_templates_room_id_gym_id_fkey";
            columns: ["room_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      coach_availabilities: {
        Row: {
          coach_id: string;
          created_at: string;
          end_time: string;
          gym_id: string;
          id: string;
          start_time: string;
          updated_at: string;
          valid_from: string;
          valid_until: string | null;
          weekday: number;
        };
        Insert: {
          coach_id: string;
          created_at?: string;
          end_time: string;
          gym_id: string;
          id?: string;
          start_time: string;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string | null;
          weekday: number;
        };
        Update: {
          coach_id?: string;
          created_at?: string;
          end_time?: string;
          gym_id?: string;
          id?: string;
          start_time?: string;
          updated_at?: string;
          valid_from?: string;
          valid_until?: string | null;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "coach_availabilities_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      coach_compensations: {
        Row: {
          coach_id: string;
          employment_type: Database["public"]["Enums"]["employment_type"];
          gym_id: string;
          hourly_rate_cents: number | null;
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          employment_type: Database["public"]["Enums"]["employment_type"];
          gym_id: string;
          hourly_rate_cents?: number | null;
          updated_at?: string;
        };
        Update: {
          coach_id?: string;
          employment_type?: Database["public"]["Enums"]["employment_type"];
          gym_id?: string;
          hourly_rate_cents?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_compensations_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      coach_disciplines: {
        Row: {
          coach_id: string;
          discipline_id: string;
          gym_id: string;
        };
        Insert: {
          coach_id: string;
          discipline_id: string;
          gym_id: string;
        };
        Update: {
          coach_id?: string;
          discipline_id?: string;
          gym_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_disciplines_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "coach_disciplines_discipline_id_gym_id_fkey";
            columns: ["discipline_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "disciplines";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      coach_shifts: {
        Row: {
          coach_id: string;
          created_at: string;
          ends_at: string;
          gym_id: string;
          id: string;
          note: string | null;
          replaced_coach_id: string | null;
          session_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["shift_status"];
          updated_at: string;
        };
        Insert: {
          coach_id: string;
          created_at?: string;
          ends_at: string;
          gym_id: string;
          id?: string;
          note?: string | null;
          replaced_coach_id?: string | null;
          session_id?: string | null;
          starts_at: string;
          status?: Database["public"]["Enums"]["shift_status"];
          updated_at?: string;
        };
        Update: {
          coach_id?: string;
          created_at?: string;
          ends_at?: string;
          gym_id?: string;
          id?: string;
          note?: string | null;
          replaced_coach_id?: string | null;
          session_id?: string | null;
          starts_at?: string;
          status?: Database["public"]["Enums"]["shift_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coach_shifts_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "coach_shifts_replaced_coach_id_gym_id_fkey";
            columns: ["replaced_coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "coach_shifts_session_id_gym_id_fkey";
            columns: ["session_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      coaches: {
        Row: {
          bio: string | null;
          created_at: string;
          display_name: string;
          gym_id: string;
          id: string;
          is_active: boolean;
          photo_url: string | null;
          profile_id: string | null;
          updated_at: string;
        };
        Insert: {
          bio?: string | null;
          created_at?: string;
          display_name: string;
          gym_id: string;
          id?: string;
          is_active?: boolean;
          photo_url?: string | null;
          profile_id?: string | null;
          updated_at?: string;
        };
        Update: {
          bio?: string | null;
          created_at?: string;
          display_name?: string;
          gym_id?: string;
          id?: string;
          is_active?: boolean;
          photo_url?: string | null;
          profile_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "coaches_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coaches_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_ledger: {
        Row: {
          booking_id: string | null;
          created_at: string;
          created_by: string | null;
          delta: number;
          expires_at: string | null;
          gym_id: string;
          id: string;
          lot_id: string | null;
          member_id: string;
          note: string | null;
          payment_id: string | null;
          plan_id: string | null;
          reason: Database["public"]["Enums"]["credit_reason"];
        };
        Insert: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          delta: number;
          expires_at?: string | null;
          gym_id: string;
          id?: string;
          lot_id?: string | null;
          member_id: string;
          note?: string | null;
          payment_id?: string | null;
          plan_id?: string | null;
          reason: Database["public"]["Enums"]["credit_reason"];
        };
        Update: {
          booking_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          delta?: number;
          expires_at?: string | null;
          gym_id?: string;
          id?: string;
          lot_id?: string | null;
          member_id?: string;
          note?: string | null;
          payment_id?: string | null;
          plan_id?: string | null;
          reason?: Database["public"]["Enums"]["credit_reason"];
        };
        Relationships: [
          {
            foreignKeyName: "credit_ledger_booking_id_gym_id_fkey";
            columns: ["booking_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "credit_ledger_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "credit_ledger";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_ledger_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "credit_ledger_payment_id_gym_id_fkey";
            columns: ["payment_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "credit_ledger_plan_id_gym_id_fkey";
            columns: ["plan_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      daily_digests: {
        Row: {
          content: NonNullable<Json>;
          day: string;
          generated_at: string;
          generated_by: string | null;
          gym_id: string;
        };
        Insert: {
          content: NonNullable<Json>;
          day: string;
          generated_at?: string;
          generated_by?: string | null;
          gym_id: string;
        };
        Update: {
          content?: NonNullable<Json>;
          day?: string;
          generated_at?: string;
          generated_by?: string | null;
          gym_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_digests_generated_by_fkey";
            columns: ["generated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_digests_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      desk_shifts: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_at: string;
          gym_id: string;
          id: string;
          note: string | null;
          profile_id: string;
          starts_at: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_at: string;
          gym_id: string;
          id?: string;
          note?: string | null;
          profile_id: string;
          starts_at: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string;
          gym_id?: string;
          id?: string;
          note?: string | null;
          profile_id?: string;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "desk_shifts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desk_shifts_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "desk_shifts_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      disciplines: {
        Row: {
          color: string;
          created_at: string;
          default_capacity: number;
          default_duration_minutes: number;
          description: string | null;
          gym_id: string;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          updated_at: string;
        };
        Insert: {
          color: string;
          created_at?: string;
          default_capacity?: number;
          default_duration_minutes?: number;
          description?: string | null;
          gym_id: string;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          default_capacity?: number;
          default_duration_minutes?: number;
          description?: string | null;
          gym_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disciplines_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      email_templates: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          gym_id: string;
          id: string;
          name: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          gym_id: string;
          id?: string;
          name: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          gym_id?: string;
          id?: string;
          name?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_templates_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      gym_closures: {
        Row: {
          created_at: string;
          day: string;
          gym_id: string;
          id: string;
          label: string;
        };
        Insert: {
          created_at?: string;
          day: string;
          gym_id: string;
          id?: string;
          label: string;
        };
        Update: {
          created_at?: string;
          day?: string;
          gym_id?: string;
          id?: string;
          label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_closures_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      gym_private_settings: {
        Row: {
          gym_id: string;
          settings: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          gym_id: string;
          settings?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          gym_id?: string;
          settings?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gym_private_settings_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: true;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      gym_roles: {
        Row: {
          created_at: string;
          gym_id: string;
          id: string;
          profile_id: string;
          role: Database["public"]["Enums"]["gym_role"];
        };
        Insert: {
          created_at?: string;
          gym_id: string;
          id?: string;
          profile_id: string;
          role: Database["public"]["Enums"]["gym_role"];
        };
        Update: {
          created_at?: string;
          gym_id?: string;
          id?: string;
          profile_id?: string;
          role?: Database["public"]["Enums"]["gym_role"];
        };
        Relationships: [
          {
            foreignKeyName: "gym_roles_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_roles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      gyms: {
        Row: {
          address: string | null;
          created_at: string;
          email: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          opening_hours: NonNullable<Json>;
          phone: string | null;
          settings: NonNullable<Json>;
          slug: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_path?: string | null;
          name: string;
          opening_hours?: NonNullable<Json>;
          phone?: string | null;
          settings?: NonNullable<Json>;
          slug: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          logo_path?: string | null;
          name?: string;
          opening_hours?: NonNullable<Json>;
          phone?: string | null;
          settings?: NonNullable<Json>;
          slug?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      integrations: {
        Row: {
          account_label: string;
          created_at: string;
          gym_id: string;
          id: string;
          last_error: string | null;
          last_synced_at: string | null;
          provider: Database["public"]["Enums"]["integration_provider"];
          settings: NonNullable<Json>;
          status: Database["public"]["Enums"]["integration_status"];
          updated_at: string;
          vault_secret_id: string | null;
        };
        Insert: {
          account_label?: string;
          created_at?: string;
          gym_id: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          provider: Database["public"]["Enums"]["integration_provider"];
          settings?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
          vault_secret_id?: string | null;
        };
        Update: {
          account_label?: string;
          created_at?: string;
          gym_id?: string;
          id?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          provider?: Database["public"]["Enums"]["integration_provider"];
          settings?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
          vault_secret_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "integrations_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      interactions: {
        Row: {
          channel: Database["public"]["Enums"]["interaction_channel"];
          created_at: string;
          created_by: string | null;
          direction: Database["public"]["Enums"]["interaction_direction"];
          gym_id: string;
          id: string;
          member_id: string | null;
          occurred_at: string;
          source_ref: string | null;
          source_url: string | null;
          subject: string | null;
          summary: string | null;
        };
        Insert: {
          channel: Database["public"]["Enums"]["interaction_channel"];
          created_at?: string;
          created_by?: string | null;
          direction: Database["public"]["Enums"]["interaction_direction"];
          gym_id: string;
          id?: string;
          member_id?: string | null;
          occurred_at?: string;
          source_ref?: string | null;
          source_url?: string | null;
          subject?: string | null;
          summary?: string | null;
        };
        Update: {
          channel?: Database["public"]["Enums"]["interaction_channel"];
          created_at?: string;
          created_by?: string | null;
          direction?: Database["public"]["Enums"]["interaction_direction"];
          gym_id?: string;
          id?: string;
          member_id?: string | null;
          occurred_at?: string;
          source_ref?: string | null;
          source_url?: string | null;
          subject?: string | null;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "interactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interactions_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interactions_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      member_care_notes: {
        Row: {
          gym_id: string;
          member_id: string;
          note: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          gym_id: string;
          member_id: string;
          note: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          gym_id?: string;
          member_id?: string;
          note?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "member_care_notes_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: true;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "member_care_notes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      members: {
        Row: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        };
        Insert: {
          acquisition_source?: string | null;
          created_at?: string;
          email?: string | null;
          first_name: string;
          gym_id: string;
          id?: string;
          last_name: string;
          marketing_email_consent_at?: string | null;
          marketing_whatsapp_consent_at?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["member_status"];
          stripe_customer_id?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Update: {
          acquisition_source?: string | null;
          created_at?: string;
          email?: string | null;
          first_name?: string;
          gym_id?: string;
          id?: string;
          last_name?: string;
          marketing_email_consent_at?: string | null;
          marketing_whatsapp_consent_at?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["member_status"];
          stripe_customer_id?: string | null;
          tags?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "members_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "members_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      outbound_messages: {
        Row: {
          body: string;
          channel: Database["public"]["Enums"]["campaign_channel"];
          created_at: string;
          dedupe_key: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          origin: Database["public"]["Enums"]["message_origin"];
          processed_at: string | null;
          ref_id: string | null;
          status: Database["public"]["Enums"]["message_status"];
          subject: string;
          to_address: string | null;
        };
        Insert: {
          body: string;
          channel?: Database["public"]["Enums"]["campaign_channel"];
          created_at?: string;
          dedupe_key?: string | null;
          gym_id: string;
          id?: string;
          member_id: string;
          origin: Database["public"]["Enums"]["message_origin"];
          processed_at?: string | null;
          ref_id?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          subject: string;
          to_address?: string | null;
        };
        Update: {
          body?: string;
          channel?: Database["public"]["Enums"]["campaign_channel"];
          created_at?: string;
          dedupe_key?: string | null;
          gym_id?: string;
          id?: string;
          member_id?: string;
          origin?: Database["public"]["Enums"]["message_origin"];
          processed_at?: string | null;
          ref_id?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          subject?: string;
          to_address?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "outbound_messages_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "outbound_messages_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          description: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at: string | null;
          plan_id: string | null;
          promo_code_id: string | null;
          recorded_by: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          gym_id: string;
          id?: string;
          member_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at?: string | null;
          plan_id?: string | null;
          promo_code_id?: string | null;
          recorded_by?: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          gym_id?: string;
          id?: string;
          member_id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          paid_at?: string | null;
          plan_id?: string | null;
          promo_code_id?: string | null;
          recorded_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "payments_plan_id_gym_id_fkey";
            columns: ["plan_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "payments_promo_code_id_gym_id_fkey";
            columns: ["promo_code_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_disciplines: {
        Row: {
          discipline_id: string;
          gym_id: string;
          plan_id: string;
        };
        Insert: {
          discipline_id: string;
          gym_id: string;
          plan_id: string;
        };
        Update: {
          discipline_id?: string;
          gym_id?: string;
          plan_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_disciplines_discipline_id_gym_id_fkey";
            columns: ["discipline_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "disciplines";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "plan_disciplines_plan_id_gym_id_fkey";
            columns: ["plan_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      plans: {
        Row: {
          all_disciplines: boolean;
          audience: string | null;
          billing_interval: Database["public"]["Enums"]["billing_interval"] | null;
          commitment_months: number | null;
          created_at: string;
          credits: number | null;
          currency: string;
          description: string | null;
          gym_id: string;
          id: string;
          is_active: boolean;
          name: string;
          position: number;
          price_cents: number;
          requires_proof: boolean;
          stripe_price_id: string | null;
          stripe_product_id: string | null;
          type: Database["public"]["Enums"]["plan_type"];
          updated_at: string;
          validity_days: number | null;
        };
        Insert: {
          all_disciplines?: boolean;
          audience?: string | null;
          billing_interval?: Database["public"]["Enums"]["billing_interval"] | null;
          commitment_months?: number | null;
          created_at?: string;
          credits?: number | null;
          currency?: string;
          description?: string | null;
          gym_id: string;
          id?: string;
          is_active?: boolean;
          name: string;
          position?: number;
          price_cents: number;
          requires_proof?: boolean;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          type: Database["public"]["Enums"]["plan_type"];
          updated_at?: string;
          validity_days?: number | null;
        };
        Update: {
          all_disciplines?: boolean;
          audience?: string | null;
          billing_interval?: Database["public"]["Enums"]["billing_interval"] | null;
          commitment_months?: number | null;
          created_at?: string;
          credits?: number | null;
          currency?: string;
          description?: string | null;
          gym_id?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          position?: number;
          price_cents?: number;
          requires_proof?: boolean;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          type?: Database["public"]["Enums"]["plan_type"];
          updated_at?: string;
          validity_days?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "plans_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          created_at: string;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          phone: string | null;
          terms_accepted_at: string | null;
          updated_at: string;
          waiver_accepted_at: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          phone?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          waiver_accepted_at?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          created_at?: string;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          phone?: string | null;
          terms_accepted_at?: string | null;
          updated_at?: string;
          waiver_accepted_at?: string | null;
        };
        Relationships: [];
      };
      promo_code_plans: {
        Row: {
          gym_id: string;
          plan_id: string;
          promo_code_id: string;
        };
        Insert: {
          gym_id: string;
          plan_id: string;
          promo_code_id: string;
        };
        Update: {
          gym_id?: string;
          plan_id?: string;
          promo_code_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promo_code_plans_plan_id_gym_id_fkey";
            columns: ["plan_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "promo_code_plans_promo_code_id_gym_id_fkey";
            columns: ["promo_code_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "promo_codes";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      promo_codes: {
        Row: {
          code: string;
          created_at: string;
          ends_on: string | null;
          gym_id: string;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["promo_kind"];
          max_redemptions: number | null;
          starts_on: string | null;
          stripe_coupon_id: string | null;
          updated_at: string;
          value: number;
        };
        Insert: {
          code: string;
          created_at?: string;
          ends_on?: string | null;
          gym_id: string;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["promo_kind"];
          max_redemptions?: number | null;
          starts_on?: string | null;
          stripe_coupon_id?: string | null;
          updated_at?: string;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          ends_on?: string | null;
          gym_id?: string;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["promo_kind"];
          max_redemptions?: number | null;
          starts_on?: string | null;
          stripe_coupon_id?: string | null;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "promo_codes_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          capacity: number;
          created_at: string;
          gym_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          capacity: number;
          created_at?: string;
          gym_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          capacity?: number;
          created_at?: string;
          gym_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      segments: {
        Row: {
          created_at: string;
          created_by: string | null;
          filters: NonNullable<Json>;
          gym_id: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          filters?: NonNullable<Json>;
          gym_id: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          filters?: NonNullable<Json>;
          gym_id?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "segments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "segments_gym_id_fkey";
            columns: ["gym_id"];
            isOneToOne: false;
            referencedRelation: "gyms";
            referencedColumns: ["id"];
          },
        ];
      };
      session_coaches: {
        Row: {
          coach_id: string;
          gym_id: string;
          position: number;
          session_id: string;
        };
        Insert: {
          coach_id: string;
          gym_id: string;
          position?: number;
          session_id: string;
        };
        Update: {
          coach_id?: string;
          gym_id?: string;
          position?: number;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_coaches_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "session_coaches_session_id_gym_id_fkey";
            columns: ["session_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          id: string;
          processed_at: string;
          type: string;
        };
        Insert: {
          id: string;
          processed_at?: string;
          type: string;
        };
        Update: {
          id?: string;
          processed_at?: string;
          type?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          cancel_at: string | null;
          canceled_at: string | null;
          commitment_ends_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          plan_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          cancel_at?: string | null;
          canceled_at?: string | null;
          commitment_ends_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          gym_id: string;
          id?: string;
          member_id: string;
          plan_id: string;
          started_at?: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at?: string | null;
          canceled_at?: string | null;
          commitment_ends_at?: string | null;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          gym_id?: string;
          id?: string;
          member_id?: string;
          plan_id?: string;
          started_at?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_member_id_gym_id_fkey";
            columns: ["member_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_gym_id_fkey";
            columns: ["plan_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
      template_coaches: {
        Row: {
          coach_id: string;
          gym_id: string;
          position: number;
          template_id: string;
        };
        Insert: {
          coach_id: string;
          gym_id: string;
          position?: number;
          template_id: string;
        };
        Update: {
          coach_id?: string;
          gym_id?: string;
          position?: number;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_coaches_coach_id_gym_id_fkey";
            columns: ["coach_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "coaches";
            referencedColumns: ["id", "gym_id"];
          },
          {
            foreignKeyName: "template_coaches_template_id_gym_id_fkey";
            columns: ["template_id", "gym_id"];
            isOneToOne: false;
            referencedRelation: "class_templates";
            referencedColumns: ["id", "gym_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_member_tag: {
        Args: { p_gym_id: string; p_member_ids: string[]; p_tag: string };
        Returns: number;
      };
      add_team_role: {
        Args: {
          p_email: string;
          p_gym_id: string;
          p_role: Database["public"]["Enums"]["gym_role"];
        };
        Returns: string;
      };
      adjust_credits: {
        Args: { p_delta: number; p_member_id: string; p_note?: string };
        Returns: number;
      };
      apply_stripe_event: {
        Args: { p_event: Json; p_method?: Database["public"]["Enums"]["payment_method"] };
        Returns: string;
      };
      billing_checkout_context: {
        Args: { p_plan_id: string; p_promo_code?: string };
        Returns: Json;
      };
      book_session: {
        Args: { p_member_id?: string; p_session_id: string };
        Returns: {
          booked_at: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          gym_id: string;
          id: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          waitlist_position: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_booking: {
        Args: { p_booking_id: string };
        Returns: {
          booked_at: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          gym_id: string;
          id: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          waitlist_position: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_manual_subscription: {
        Args: { p_subscription_id: string };
        Returns: {
          cancel_at: string | null;
          canceled_at: string | null;
          commitment_ends_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          plan_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cancel_session: {
        Args: { p_reason?: string; p_session_id: string };
        Returns: {
          booked_count: number;
          cancellation_reason: string | null;
          capacity: number;
          coach_id: string | null;
          created_at: string;
          discipline_id: string;
          ends_at: string;
          gym_id: string;
          id: string;
          is_customized: boolean;
          room_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["session_status"];
          template_id: string | null;
          updated_at: string;
          waitlist_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "class_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      coach_hours: {
        Args: { p_from: string; p_gym_id: string; p_to: string };
        Returns: {
          amount_cents: number;
          coach_id: string;
          display_name: string;
          hourly_rate_cents: number;
          minutes: number;
          sessions: number;
        }[];
      };
      create_member: {
        Args: {
          p_email?: string;
          p_first_name: string;
          p_force?: boolean;
          p_gym_id: string;
          p_last_name: string;
          p_phone?: string;
          p_status?: Database["public"]["Enums"]["member_status"];
        };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_session: {
        Args: {
          p_capacity?: number;
          p_coach_ids?: string[];
          p_discipline_id: string;
          p_duration_minutes?: number;
          p_gym_id: string;
          p_room_id?: string;
          p_starts_at: string;
        };
        Returns: {
          booked_count: number;
          cancellation_reason: string | null;
          capacity: number;
          coach_id: string | null;
          created_at: string;
          discipline_id: string;
          ends_at: string;
          gym_id: string;
          id: string;
          is_customized: boolean;
          room_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["session_status"];
          template_id: string | null;
          updated_at: string;
          waitlist_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "class_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      crm_pipeline: {
        Args: { p_gym_id: string };
        Returns: {
          bookings: number;
          email: string;
          first_name: string;
          last_activity_at: string;
          last_name: string;
          member_id: string;
          phone: string;
          stage: string;
          status: Database["public"]["Enums"]["member_status"];
        }[];
      };
      crm_todo: {
        Args: { p_gym_id: string };
        Returns: {
          kind: string;
          member_ids: string[];
          total: number;
        }[];
      };
      export_members: {
        Args: { p_gym_id: string; p_member_ids: string[] };
        Returns: {
          created_at: string;
          credits: number;
          email: string;
          email_consent: boolean;
          first_name: string;
          last_name: string;
          phone: string;
          status: Database["public"]["Enums"]["member_status"];
          tags: string[];
          whatsapp_consent: boolean;
        }[];
      };
      export_payments: {
        Args: { p_from: string; p_gym_id: string; p_to: string };
        Returns: {
          amount_cents: number;
          currency: string;
          description: string;
          member_name: string;
          method: Database["public"]["Enums"]["payment_method"];
          paid_on: string;
          plan_name: string;
          promo_code: string;
          status: Database["public"]["Enums"]["payment_status"];
        }[];
      };
      filter_members: {
        Args: { p_filters: Json; p_gym_id: string };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      find_member_duplicates: {
        Args: { p_email: string; p_gym_id: string; p_phone: string };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      generate_sessions: {
        Args: { p_from: string; p_gym_id: string; p_to: string };
        Returns: number;
      };
      gym_kpis: { Args: { p_from: string; p_gym_id: string; p_to: string }; Returns: Json };
      join_gym: {
        Args: { p_terms_accepted: boolean; p_waiver_accepted: boolean };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      log_ai_call: {
        Args: {
          p_conversation_id?: string;
          p_gym_id: string;
          p_input_tokens: number;
          p_model: string;
          p_output_tokens: number;
          p_tools: string[];
        };
        Returns: undefined;
      };
      member_overview: { Args: { p_member_id: string }; Returns: Json };
      move_session: {
        Args: { p_session_id: string; p_starts_at: string };
        Returns: {
          booked_count: number;
          cancellation_reason: string | null;
          capacity: number;
          coach_id: string | null;
          created_at: string;
          discipline_id: string;
          ends_at: string;
          gym_id: string;
          id: string;
          is_customized: boolean;
          room_id: string | null;
          starts_at: string;
          status: Database["public"]["Enums"]["session_status"];
          template_id: string | null;
          updated_at: string;
          waitlist_count: number;
        };
        SetofOptions: {
          from: "*";
          to: "class_sessions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      nav_counts: {
        Args: { p_gym_id: string };
        Returns: {
          prospects: number;
          trials_to_call: number;
          unanswered: number;
          unpaid: number;
        }[];
      };
      preview_template: {
        Args: { p_body: string; p_gym_id: string; p_member_id?: string; p_subject: string };
        Returns: {
          body: string;
          member_name: string;
          subject: string;
        }[];
      };
      price_quote: {
        Args: { p_plan_id: string; p_promo_code?: string };
        Returns: {
          final_cents: number;
          price_cents: number;
          promo_code_id: string;
        }[];
      };
      record_manual_sale: {
        Args: {
          p_member_id: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_plan_id: string;
          p_promo_code?: string;
        };
        Returns: {
          amount_cents: number;
          created_at: string;
          currency: string;
          description: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          method: Database["public"]["Enums"]["payment_method"];
          paid_at: string | null;
          plan_id: string | null;
          promo_code_id: string | null;
          recorded_by: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "payments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_team_role: {
        Args: {
          p_gym_id: string;
          p_profile_id: string;
          p_role: Database["public"]["Enums"]["gym_role"];
        };
        Returns: undefined;
      };
      renew_manual_subscription: {
        Args: {
          p_method: Database["public"]["Enums"]["payment_method"];
          p_subscription_id: string;
        };
        Returns: {
          cancel_at: string | null;
          canceled_at: string | null;
          commitment_ends_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          plan_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder_disciplines: { Args: { p_gym_id: string; p_ids: string[] }; Returns: undefined };
      reset_attendance: {
        Args: { p_booking_id: string };
        Returns: {
          booked_at: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          gym_id: string;
          id: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          waitlist_position: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      search_members: {
        Args: {
          p_gym_id: string;
          p_limit?: number;
          p_offset?: number;
          p_query?: string;
          p_sort?: string;
          p_statuses?: Database["public"]["Enums"]["member_status"][];
          p_tag?: string;
        };
        Returns: {
          created_at: string;
          credits: number;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          phone: string;
          status: Database["public"]["Enums"]["member_status"];
          tags: string[];
          total_count: number;
        }[];
      };
      segment_audience: {
        Args: { p_segment_id: string };
        Returns: {
          reachable: number;
          targeted: number;
        }[];
      };
      segment_members: {
        Args: { p_segment_id: string };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      send_campaign: {
        Args: { p_campaign_id: string };
        Returns: {
          channel: Database["public"]["Enums"]["campaign_channel"];
          content: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          gym_id: string;
          id: string;
          name: string;
          scheduled_at: string | null;
          segment: NonNullable<Json>;
          sent_at: string | null;
          stats: NonNullable<Json>;
          status: Database["public"]["Enums"]["campaign_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "campaigns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      send_direct_message: {
        Args: { p_body: string; p_gym_id: string; p_member_ids: string[]; p_subject: string };
        Returns: number;
      };
      session_coach_options: {
        Args: { p_session_id: string };
        Returns: {
          available: boolean;
          coach_id: string;
          display_name: string;
          has_conflict: boolean;
          is_current: boolean;
          teaches_discipline: boolean;
        }[];
      };
      session_move_preview: {
        Args: { p_session_id: string; p_starts_at: string };
        Returns: {
          booked: number;
          coach_conflict: boolean;
          waitlisted: number;
        }[];
      };
      session_stats: {
        Args: {
          p_discipline_id?: string;
          p_from: string;
          p_gym_id: string;
          p_local_time?: string;
          p_to: string;
        };
        Returns: {
          attended: number;
          booked: number;
          cancelled: boolean;
          capacity: number;
          coaches: string;
          discipline: string;
          no_show: number;
          session_id: string;
          starts_at: string;
          waitlisted: number;
        }[];
      };
      set_attendance: {
        Args: { p_booking_id: string; p_status: Database["public"]["Enums"]["booking_status"] };
        Returns: {
          booked_at: string;
          cancelled_at: string | null;
          checked_in_at: string | null;
          created_at: string;
          gym_id: string;
          id: string;
          member_id: string;
          session_id: string;
          status: Database["public"]["Enums"]["booking_status"];
          updated_at: string;
          waitlist_position: number | null;
        };
        SetofOptions: {
          from: "*";
          to: "bookings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_attendance_many: { Args: { p_session_id: string }; Returns: string[] };
      set_member_status: {
        Args: { p_member_id: string; p_status: Database["public"]["Enums"]["member_status"] };
        Returns: {
          acquisition_source: string | null;
          created_at: string;
          email: string | null;
          first_name: string;
          gym_id: string;
          id: string;
          last_name: string;
          marketing_email_consent_at: string | null;
          marketing_whatsapp_consent_at: string | null;
          phone: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["member_status"];
          stripe_customer_id: string | null;
          tags: string[];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "members";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      sync_stripe_subscription: {
        Args: { p_sub: Json };
        Returns: {
          cancel_at: string | null;
          canceled_at: string | null;
          commitment_ends_at: string | null;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          gym_id: string;
          id: string;
          member_id: string;
          plan_id: string;
          started_at: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "subscriptions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      tag_suggestions: {
        Args: { p_gym_id: string; p_limit?: number; p_query?: string };
        Returns: {
          tag: string;
          uses: number;
        }[];
      };
      team_members: {
        Args: { p_gym_id: string };
        Returns: {
          email: string;
          first_name: string;
          last_name: string;
          profile_id: string;
          roles: Database["public"]["Enums"]["gym_role"][];
        }[];
      };
      template_change_preview: {
        Args: { p_template_id: string };
        Returns: {
          booked: number;
          kept: number;
          sessions: number;
        }[];
      };
      today_trials: {
        Args: { p_day: string; p_gym_id: string };
        Returns: {
          coaches: string;
          color: string;
          discipline: string;
          first_name: string;
          is_trial: boolean;
          last_name: string;
          member_id: string;
          note: string;
          session_id: string;
          starts_at: string;
          visit_number: number;
        }[];
      };
      unpaid_members: {
        Args: { p_gym_id: string };
        Returns: {
          amount_cents: number;
          failures: number;
          first_failed_at: string;
          first_name: string;
          last_name: string;
          member_id: string;
          plan: string;
        }[];
      };
      update_gym_settings: {
        Args: { p_gym_id: string; p_private?: Json; p_settings?: Json };
        Returns: undefined;
      };
      update_session: {
        Args: { p_changes: Json; p_scope?: string; p_session_id: string };
        Returns: number;
      };
      update_template: { Args: { p_changes: Json; p_template_id: string }; Returns: Json };
    };
    Enums: {
      automation_kind: "welcome" | "inactive" | "birthday";
      billing_interval: "month" | "year";
      booking_status: "confirmed" | "waitlisted" | "cancelled" | "no_show" | "attended";
      campaign_channel: "email" | "whatsapp";
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
      credit_reason:
        "purchase" | "renewal" | "booking" | "booking_refund" | "expiration" | "manual_adjustment";
      employment_type: "employee" | "freelance";
      gym_role: "member" | "coach" | "staff" | "manager" | "admin";
      integration_provider: "gmail" | "whatsapp" | "pennylane" | "stripe";
      integration_status: "disconnected" | "connected" | "error";
      interaction_channel: "email" | "whatsapp" | "phone" | "note";
      interaction_direction: "inbound" | "outbound" | "internal";
      member_status: "prospect" | "active" | "suspended" | "cancelled";
      message_origin:
        | "session_cancelled"
        | "session_moved"
        | "coach_changed"
        | "campaign"
        | "automation"
        | "direct"
        | "billing";
      message_status: "queued" | "logged" | "sent" | "failed";
      payment_method: "card" | "sepa_debit" | "cash" | "other";
      payment_status: "pending" | "succeeded" | "failed" | "refunded";
      plan_type: "recurring" | "pack" | "single";
      promo_kind: "percent" | "amount";
      session_status: "scheduled" | "cancelled";
      shift_status: "planned" | "done" | "cancelled";
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "paused"
        | "canceled"
        | "unpaid";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      automation_kind: ["welcome", "inactive", "birthday"],
      billing_interval: ["month", "year"],
      booking_status: ["confirmed", "waitlisted", "cancelled", "no_show", "attended"],
      campaign_channel: ["email", "whatsapp"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "cancelled"],
      credit_reason: [
        "purchase",
        "renewal",
        "booking",
        "booking_refund",
        "expiration",
        "manual_adjustment",
      ],
      employment_type: ["employee", "freelance"],
      gym_role: ["member", "coach", "staff", "manager", "admin"],
      integration_provider: ["gmail", "whatsapp", "pennylane", "stripe"],
      integration_status: ["disconnected", "connected", "error"],
      interaction_channel: ["email", "whatsapp", "phone", "note"],
      interaction_direction: ["inbound", "outbound", "internal"],
      member_status: ["prospect", "active", "suspended", "cancelled"],
      message_origin: [
        "session_cancelled",
        "session_moved",
        "coach_changed",
        "campaign",
        "automation",
        "direct",
        "billing",
      ],
      message_status: ["queued", "logged", "sent", "failed"],
      payment_method: ["card", "sepa_debit", "cash", "other"],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      plan_type: ["recurring", "pack", "single"],
      promo_kind: ["percent", "amount"],
      session_status: ["scheduled", "cancelled"],
      shift_status: ["planned", "done", "cancelled"],
      subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "paused",
        "canceled",
        "unpaid",
      ],
    },
  },
} as const;
