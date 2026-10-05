export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      ai_explanations: {
        Row: {
          created_at: string;
          locale: string;
          model: string;
          question_id: string;
          question_version: number;
          text: string;
        };
        Insert: {
          created_at?: string;
          locale: string;
          model: string;
          question_id: string;
          question_version: number;
          text: string;
        };
        Update: {
          created_at?: string;
          locale?: string;
          model?: string;
          question_id?: string;
          question_version?: number;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_explanations_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_usage: {
        Row: {
          cache_read_tokens: number;
          cache_write_tokens: number;
          country_code: string | null;
          created_at: string;
          feature: Database['public']['Enums']['ai_feature'];
          id: number;
          input_tokens: number;
          model: string;
          output_tokens: number;
          question_id: string | null;
          user_id: string;
        };
        Insert: {
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          country_code?: string | null;
          created_at?: string;
          feature: Database['public']['Enums']['ai_feature'];
          id?: never;
          input_tokens: number;
          model: string;
          output_tokens: number;
          question_id?: string | null;
          user_id: string;
        };
        Update: {
          cache_read_tokens?: number;
          cache_write_tokens?: number;
          country_code?: string | null;
          created_at?: string;
          feature?: Database['public']['Enums']['ai_feature'];
          id?: never;
          input_tokens?: number;
          model?: string;
          output_tokens?: number;
          question_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_usage_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
          {
            foreignKeyName: 'ai_usage_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_usage_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      answer_events: {
        Row: {
          attempt_id: string;
          client_event_id: string | null;
          correct: boolean;
          created_at: string;
          id: number;
          question_id: string;
          question_version: number;
          selected_answer: Json | null;
          time_ms: number;
          user_id: string;
        };
        Insert: {
          attempt_id: string;
          client_event_id?: string | null;
          correct: boolean;
          created_at?: string;
          id?: never;
          question_id: string;
          question_version: number;
          selected_answer?: Json | null;
          time_ms: number;
          user_id?: string;
        };
        Update: {
          attempt_id?: string;
          client_event_id?: string | null;
          correct?: boolean;
          created_at?: string;
          id?: never;
          question_id?: string;
          question_version?: number;
          selected_answer?: Json | null;
          time_ms?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'answer_events_attempt_id_user_id_fkey';
            columns: ['attempt_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'attempts';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'answer_events_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'answer_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      attempts: {
        Row: {
          completed_at: string | null;
          correct_count: number;
          country_code: string;
          id: string;
          mock_exam_id: string | null;
          mode: Database['public']['Enums']['attempt_mode'];
          question_count: number;
          question_ids: string[];
          started_at: string;
          topic_id: string | null;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          correct_count?: number;
          country_code: string;
          id?: string;
          mock_exam_id?: string | null;
          mode?: Database['public']['Enums']['attempt_mode'];
          question_count?: number;
          question_ids?: string[];
          started_at?: string;
          topic_id?: string | null;
          user_id?: string;
        };
        Update: {
          completed_at?: string | null;
          correct_count?: number;
          country_code?: string;
          id?: string;
          mock_exam_id?: string | null;
          mode?: Database['public']['Enums']['attempt_mode'];
          question_count?: number;
          question_ids?: string[];
          started_at?: string;
          topic_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'attempts_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
          {
            foreignKeyName: 'attempts_mock_exam_id_user_id_fkey';
            columns: ['mock_exam_id', 'user_id'];
            isOneToOne: false;
            referencedRelation: 'mock_exams';
            referencedColumns: ['id', 'user_id'];
          },
          {
            foreignKeyName: 'attempts_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'attempts_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      audio_clips: {
        Row: {
          byte_size: number;
          char_count: number;
          content_type: string;
          created_at: string;
          data: string;
          id: string;
          locale: string;
          voice: string;
        };
        Insert: {
          byte_size: number;
          char_count: number;
          content_type: string;
          created_at?: string;
          data: string;
          id: string;
          locale: string;
          voice: string;
        };
        Update: {
          byte_size?: number;
          char_count?: number;
          content_type?: string;
          created_at?: string;
          data?: string;
          id?: string;
          locale?: string;
          voice?: string;
        };
        Relationships: [];
      };
      community_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_hidden: boolean;
          parent_comment_id: string | null;
          post_id: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          body: string;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          parent_comment_id?: string | null;
          post_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          parent_comment_id?: string | null;
          post_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_comments_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_comments_parent_comment_id_post_id_fkey';
            columns: ['parent_comment_id', 'post_id'];
            isOneToOne: false;
            referencedRelation: 'community_comments';
            referencedColumns: ['id', 'post_id'];
          },
          {
            foreignKeyName: 'community_comments_post_id_fkey';
            columns: ['post_id'];
            isOneToOne: false;
            referencedRelation: 'community_posts';
            referencedColumns: ['id'];
          },
        ];
      };
      community_posts: {
        Row: {
          author_id: string;
          body: string;
          country_code: string | null;
          created_at: string;
          id: string;
          is_hidden: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          author_id?: string;
          body: string;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          country_code?: string | null;
          created_at?: string;
          id?: string;
          is_hidden?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'community_posts_author_id_fkey';
            columns: ['author_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'community_posts_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
        ];
      };
      content_flags: {
        Row: {
          created_at: string;
          details: string | null;
          id: string;
          locale: string | null;
          question_id: string;
          reason: Database['public']['Enums']['flag_reason'];
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          status: Database['public']['Enums']['flag_status'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          details?: string | null;
          id?: string;
          locale?: string | null;
          question_id: string;
          reason: Database['public']['Enums']['flag_reason'];
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['flag_status'];
          user_id?: string;
        };
        Update: {
          created_at?: string;
          details?: string | null;
          id?: string;
          locale?: string | null;
          question_id?: string;
          reason?: Database['public']['Enums']['flag_reason'];
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          status?: Database['public']['Enums']['flag_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'content_flags_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_flags_resolved_by_fkey';
            columns: ['resolved_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'content_flags_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      countries: {
        Row: {
          created_at: string;
          exam_languages: string[];
          has_exam: boolean;
          iso_code: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exam_languages?: string[];
          has_exam?: boolean;
          iso_code: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exam_languages?: string[];
          has_exam?: boolean;
          iso_code?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exam_formats: {
        Row: {
          blueprint: Json | null;
          country_code: string;
          created_at: string;
          format_type: Database['public']['Enums']['exam_format_type'];
          id: string;
          is_current: boolean;
          last_verified_at: string | null;
          name: string;
          notes: string | null;
          pass_mark: number | null;
          question_count: number | null;
          question_pool_size: number | null;
          slug: string;
          source_url: string;
          time_limit_minutes: number | null;
          updated_at: string;
        };
        Insert: {
          blueprint?: Json | null;
          country_code: string;
          created_at?: string;
          format_type: Database['public']['Enums']['exam_format_type'];
          id?: string;
          is_current?: boolean;
          last_verified_at?: string | null;
          name: string;
          notes?: string | null;
          pass_mark?: number | null;
          question_count?: number | null;
          question_pool_size?: number | null;
          slug: string;
          source_url: string;
          time_limit_minutes?: number | null;
          updated_at?: string;
        };
        Update: {
          blueprint?: Json | null;
          country_code?: string;
          created_at?: string;
          format_type?: Database['public']['Enums']['exam_format_type'];
          id?: string;
          is_current?: boolean;
          last_verified_at?: string | null;
          name?: string;
          notes?: string | null;
          pass_mark?: number | null;
          question_count?: number | null;
          question_pool_size?: number | null;
          slug?: string;
          source_url?: string;
          time_limit_minutes?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exam_formats_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
        ];
      };
      mastery: {
        Row: {
          answered_count: number;
          correct_count: number;
          last_answered_at: string | null;
          score: number;
          topic_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          answered_count?: number;
          correct_count?: number;
          last_answered_at?: string | null;
          score: number;
          topic_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          answered_count?: number;
          correct_count?: number;
          last_answered_at?: string | null;
          score?: number;
          topic_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mastery_topic_id_fkey';
            columns: ['topic_id'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mastery_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      mock_exams: {
        Row: {
          correct_count: number | null;
          created_at: string;
          exam_format_id: string;
          id: string;
          passed: boolean | null;
          question_ids: string[];
          started_at: string;
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          correct_count?: number | null;
          created_at?: string;
          exam_format_id: string;
          id?: string;
          passed?: boolean | null;
          question_ids: string[];
          started_at?: string;
          submitted_at?: string | null;
          user_id?: string;
        };
        Update: {
          correct_count?: number | null;
          created_at?: string;
          exam_format_id?: string;
          id?: string;
          passed?: boolean | null;
          question_ids?: string[];
          started_at?: string;
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'mock_exams_exam_format_id_fkey';
            columns: ['exam_format_id'];
            isOneToOne: false;
            referencedRelation: 'exam_formats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'mock_exams_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string;
          invited_by: string | null;
          organization_id: string;
          role: Database['public']['Enums']['org_role'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          invited_by?: string | null;
          organization_id: string;
          role?: Database['public']['Enums']['org_role'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          invited_by?: string | null;
          organization_id?: string;
          role?: Database['public']['Enums']['org_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'org_members_invited_by_fkey';
            columns: ['invited_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'org_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'org_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          seat_limit: number | null;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          seat_limit?: number | null;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          seat_limit?: number | null;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      question_reviews: {
        Row: {
          action: string;
          created_at: string;
          id: number;
          locale: string | null;
          note: string | null;
          question_id: string;
          reviewer_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          id?: never;
          locale?: string | null;
          note?: string | null;
          question_id: string;
          reviewer_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          id?: never;
          locale?: string | null;
          note?: string | null;
          question_id?: string;
          reviewer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'question_reviews_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'question_reviews_reviewer_id_fkey';
            columns: ['reviewer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      question_translations: {
        Row: {
          created_at: string;
          drafted_by_model: string | null;
          explanation: string | null;
          locale: string;
          options: Json;
          question_id: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database['public']['Enums']['translation_status'];
          text: string;
          translated_from: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          drafted_by_model?: string | null;
          explanation?: string | null;
          locale: string;
          options?: Json;
          question_id: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['translation_status'];
          text: string;
          translated_from?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          drafted_by_model?: string | null;
          explanation?: string | null;
          locale?: string;
          options?: Json;
          question_id?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database['public']['Enums']['translation_status'];
          text?: string;
          translated_from?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'question_translations_question_id_fkey';
            columns: ['question_id'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'question_translations_reviewed_by_fkey';
            columns: ['reviewed_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      questions: {
        Row: {
          correct_answer: Json;
          country_code: string;
          created_at: string;
          created_by: string | null;
          difficulty: number;
          drafted_by_model: string | null;
          duplicate_of: string | null;
          exam_format_id: string | null;
          id: string;
          last_verified_at: string | null;
          published_at: string | null;
          region_code: string | null;
          source_changed_at: string | null;
          source_passage_id: string | null;
          source_quote: string | null;
          source_url: string;
          status: Database['public']['Enums']['question_status'];
          topic_id: string;
          type: Database['public']['Enums']['question_type'];
          updated_at: string;
          verified_by: string | null;
          version: number;
        };
        Insert: {
          correct_answer: Json;
          country_code: string;
          created_at?: string;
          created_by?: string | null;
          difficulty: number;
          drafted_by_model?: string | null;
          duplicate_of?: string | null;
          exam_format_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          published_at?: string | null;
          region_code?: string | null;
          source_changed_at?: string | null;
          source_passage_id?: string | null;
          source_quote?: string | null;
          source_url: string;
          status?: Database['public']['Enums']['question_status'];
          topic_id: string;
          type: Database['public']['Enums']['question_type'];
          updated_at?: string;
          verified_by?: string | null;
          version?: number;
        };
        Update: {
          correct_answer?: Json;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          difficulty?: number;
          drafted_by_model?: string | null;
          duplicate_of?: string | null;
          exam_format_id?: string | null;
          id?: string;
          last_verified_at?: string | null;
          published_at?: string | null;
          region_code?: string | null;
          source_changed_at?: string | null;
          source_passage_id?: string | null;
          source_quote?: string | null;
          source_url?: string;
          status?: Database['public']['Enums']['question_status'];
          topic_id?: string;
          type?: Database['public']['Enums']['question_type'];
          updated_at?: string;
          verified_by?: string | null;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
          {
            foreignKeyName: 'questions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questions_duplicate_of_fkey';
            columns: ['duplicate_of'];
            isOneToOne: false;
            referencedRelation: 'questions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questions_exam_format_id_fkey';
            columns: ['exam_format_id'];
            isOneToOne: false;
            referencedRelation: 'exam_formats';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questions_source_passage_id_fkey';
            columns: ['source_passage_id'];
            isOneToOne: false;
            referencedRelation: 'source_passages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'questions_topic_id_country_code_fkey';
            columns: ['topic_id', 'country_code'];
            isOneToOne: false;
            referencedRelation: 'topics';
            referencedColumns: ['id', 'country_code'];
          },
          {
            foreignKeyName: 'questions_verified_by_fkey';
            columns: ['verified_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      source_documents: {
        Row: {
          byte_size: number;
          changed_at: string | null;
          content_hash: string;
          country_code: string;
          created_at: string;
          fetched_at: string;
          id: string;
          is_refetchable: boolean;
          last_checked_at: string;
          license: string;
          locale: string;
          media_type: string;
          publisher: string | null;
          raw_hash: string;
          source_url: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          byte_size: number;
          changed_at?: string | null;
          content_hash: string;
          country_code: string;
          created_at?: string;
          fetched_at?: string;
          id?: string;
          is_refetchable?: boolean;
          last_checked_at?: string;
          license: string;
          locale: string;
          media_type: string;
          publisher?: string | null;
          raw_hash: string;
          source_url: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          byte_size?: number;
          changed_at?: string | null;
          content_hash?: string;
          country_code?: string;
          created_at?: string;
          fetched_at?: string;
          id?: string;
          is_refetchable?: boolean;
          last_checked_at?: string;
          license?: string;
          locale?: string;
          media_type?: string;
          publisher?: string | null;
          raw_hash?: string;
          source_url?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'source_documents_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
        ];
      };
      source_passages: {
        Row: {
          content_hash: string;
          created_at: string;
          document_id: string;
          heading: string | null;
          id: string;
          is_current: boolean;
          ordinal: number;
          superseded_at: string | null;
          text: string;
        };
        Insert: {
          content_hash: string;
          created_at?: string;
          document_id: string;
          heading?: string | null;
          id?: string;
          is_current?: boolean;
          ordinal: number;
          superseded_at?: string | null;
          text: string;
        };
        Update: {
          content_hash?: string;
          created_at?: string;
          document_id?: string;
          heading?: string | null;
          id?: string;
          is_current?: boolean;
          ordinal?: number;
          superseded_at?: string | null;
          text?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'source_passages_document_id_fkey';
            columns: ['document_id'];
            isOneToOne: false;
            referencedRelation: 'source_documents';
            referencedColumns: ['id'];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          organization_id: string | null;
          plan: string;
          provider: string;
          provider_subscription_id: string | null;
          status: Database['public']['Enums']['subscription_status'];
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          organization_id?: string | null;
          plan: string;
          provider: string;
          provider_subscription_id?: string | null;
          status: Database['public']['Enums']['subscription_status'];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          organization_id?: string | null;
          plan?: string;
          provider?: string;
          provider_subscription_id?: string | null;
          status?: Database['public']['Enums']['subscription_status'];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      topics: {
        Row: {
          country_code: string;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'topics_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
        ];
      };
      user_countries: {
        Row: {
          country_code: string;
          created_at: string;
          exam_date: string | null;
          is_primary: boolean;
          study_locale: string | null;
          user_id: string;
        };
        Insert: {
          country_code: string;
          created_at?: string;
          exam_date?: string | null;
          is_primary?: boolean;
          study_locale?: string | null;
          user_id?: string;
        };
        Update: {
          country_code?: string;
          created_at?: string;
          exam_date?: string | null;
          is_primary?: boolean;
          study_locale?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_countries_country_code_fkey';
            columns: ['country_code'];
            isOneToOne: false;
            referencedRelation: 'countries';
            referencedColumns: ['iso_code'];
          },
          {
            foreignKeyName: 'user_countries_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_roles: {
        Row: {
          granted_at: string;
          granted_by: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Insert: {
          granted_at?: string;
          granted_by?: string | null;
          role: Database['public']['Enums']['app_role'];
          user_id: string;
        };
        Update: {
          granted_at?: string;
          granted_by?: string | null;
          role?: Database['public']['Enums']['app_role'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_roles_granted_by_fkey';
            columns: ['granted_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_roles_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settings: {
        Row: {
          created_at: string;
          daily_goal_minutes: number;
          onboarded_at: string | null;
          time_zone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          daily_goal_minutes?: number;
          onboarded_at?: string | null;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          daily_goal_minutes?: number;
          onboarded_at?: string | null;
          time_zone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settings_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      ai_feature: 'explanation' | 'tutor';
      app_role: 'reviewer' | 'admin';
      attempt_mode: 'practice' | 'review' | 'mock_exam';
      exam_format_type: 'written' | 'oral' | 'interview' | 'language';
      flag_reason: 'outdated' | 'incorrect' | 'unclear' | 'translation' | 'other';
      flag_status: 'open' | 'resolved' | 'dismissed';
      org_role: 'owner' | 'admin' | 'member';
      question_status: 'draft' | 'in_review' | 'published' | 'retired' | 'rejected';
      question_type: 'multiple_choice' | 'multi_select' | 'true_false' | 'free_response';
      subscription_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired';
      translation_status: 'draft' | 'approved';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_feature: ['explanation', 'tutor'],
      app_role: ['reviewer', 'admin'],
      attempt_mode: ['practice', 'review', 'mock_exam'],
      exam_format_type: ['written', 'oral', 'interview', 'language'],
      flag_reason: ['outdated', 'incorrect', 'unclear', 'translation', 'other'],
      flag_status: ['open', 'resolved', 'dismissed'],
      org_role: ['owner', 'admin', 'member'],
      question_status: ['draft', 'in_review', 'published', 'retired', 'rejected'],
      question_type: ['multiple_choice', 'multi_select', 'true_false', 'free_response'],
      subscription_status: ['trialing', 'active', 'past_due', 'canceled', 'expired'],
      translation_status: ['draft', 'approved'],
    },
  },
} as const;
