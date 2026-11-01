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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      explanation_cache: {
        Row: {
          cache_key: string
          created_at: string
          explanation: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          explanation: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          explanation?: string
        }
        Relationships: []
      }
      explanation_usage: {
        Row: {
          usage_date: string
          used: number
          user_id: string
        }
        Insert: {
          usage_date: string
          used?: number
          user_id: string
        }
        Update: {
          usage_date?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      game_learnings: {
        Row: {
          claim_token: string
          content: string | null
          error_status: number | null
          game_id: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claim_token?: string
          content?: string | null
          error_status?: number | null
          game_id: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claim_token?: string
          content?: string | null
          error_status?: number | null
          game_id?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_learnings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          blunders: number
          coach_mode: string
          created_at: string
          current_fen: string | null
          external_id: string | null
          hints_used: number
          id: string
          inaccuracies: number
          mistakes: number
          moves: Json
          opponent: string | null
          opponent_elo: number | null
          pgn: string | null
          player_color: string
          rated: boolean
          result: string | null
          skills_analyzed: boolean
          snapshot: Json | null
          source: string
          status: string
          takebacks: number
          time_control: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blunders?: number
          coach_mode?: string
          created_at?: string
          current_fen?: string | null
          external_id?: string | null
          hints_used?: number
          id?: string
          inaccuracies?: number
          mistakes?: number
          moves?: Json
          opponent?: string | null
          opponent_elo?: number | null
          pgn?: string | null
          player_color?: string
          rated?: boolean
          result?: string | null
          skills_analyzed?: boolean
          snapshot?: Json | null
          source?: string
          status?: string
          takebacks?: number
          time_control?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blunders?: number
          coach_mode?: string
          created_at?: string
          current_fen?: string | null
          external_id?: string | null
          hints_used?: number
          id?: string
          inaccuracies?: number
          mistakes?: number
          moves?: Json
          opponent?: string | null
          opponent_elo?: number | null
          pgn?: string | null
          player_color?: string
          rated?: boolean
          result?: string | null
          skills_analyzed?: boolean
          snapshot?: Json | null
          source?: string
          status?: string
          takebacks?: number
          time_control?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          rating: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          rating?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          rating?: number
        }
        Relationships: []
      }
      puzzles: {
        Row: {
          attempts: number
          best_line: string | null
          best_san: string | null
          best_uci: string
          categories: string[]
          created_at: string
          failed_count: number
          fen: string
          first_attempt_at: string | null
          first_try_success: boolean | null
          game_id: string | null
          id: string
          last_attempt_at: string | null
          mistake_type: string
          played_san: string
          severity: string
          solved_count: number
          source_move_key: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempts?: number
          best_line?: string | null
          best_san?: string | null
          best_uci: string
          categories?: string[]
          created_at?: string
          failed_count?: number
          fen: string
          first_attempt_at?: string | null
          first_try_success?: boolean | null
          game_id?: string | null
          id?: string
          last_attempt_at?: string | null
          mistake_type?: string
          played_san: string
          severity?: string
          solved_count?: number
          source_move_key?: string | null
          status?: string
          user_id: string
        }
        Update: {
          attempts?: number
          best_line?: string | null
          best_san?: string | null
          best_uci?: string
          categories?: string[]
          created_at?: string
          failed_count?: number
          fen?: string
          first_attempt_at?: string | null
          first_try_success?: boolean | null
          game_id?: string | null
          id?: string
          last_attempt_at?: string | null
          mistake_type?: string
          played_san?: string
          severity?: string
          solved_count?: number
          source_move_key?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "puzzles_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_game_learnings: {
        Args: { p_game_id: string; p_user_id: string }
        Returns: boolean
      }
      consume_explanation_allowance: {
        Args: { p_limit: number; p_user_id: string }
        Returns: boolean
      }
      merge_coaching_records: {
        Args: { p_game_id: string; p_records: Json; p_skills?: boolean }
        Returns: undefined
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
