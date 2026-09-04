export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          display_name: string
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      api_example_translations: {
        Row: {
          example_id: string
          id: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md: string | null
          title: string
        }
        Insert: {
          example_id: string
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
          title: string
        }
        Update: {
          example_id?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_example_translations_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "api_examples"
            referencedColumns: ["id"]
          },
        ]
      }
      api_examples: {
        Row: {
          code: string
          display_order: number
          endpoint: string
          id: string
          method: Database["public"]["Enums"]["http_method"]
          project_id: string
          request_body: string | null
          request_headers_json: Json | null
          response_body: string | null
          response_status: number | null
        }
        Insert: {
          code: string
          display_order?: number
          endpoint: string
          id?: string
          method?: Database["public"]["Enums"]["http_method"]
          project_id: string
          request_body?: string | null
          request_headers_json?: Json | null
          response_body?: string | null
          response_status?: number | null
        }
        Update: {
          code?: string
          display_order?: number
          endpoint?: string
          id?: string
          method?: Database["public"]["Enums"]["http_method"]
          project_id?: string
          request_body?: string | null
          request_headers_json?: Json | null
          response_body?: string | null
          response_status?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_examples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_report_translations: {
        Row: {
          actual_md: string | null
          bug_id: string
          expected_md: string | null
          id: string
          locale: Database["public"]["Enums"]["locale"]
          resolution_md: string | null
          root_cause_md: string | null
          steps_md: string | null
          summary_md: string | null
          title: string
        }
        Insert: {
          actual_md?: string | null
          bug_id: string
          expected_md?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          resolution_md?: string | null
          root_cause_md?: string | null
          steps_md?: string | null
          summary_md?: string | null
          title: string
        }
        Update: {
          actual_md?: string | null
          bug_id?: string
          expected_md?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          resolution_md?: string | null
          root_cause_md?: string | null
          steps_md?: string | null
          summary_md?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "bug_report_translations_bug_id_fkey"
            columns: ["bug_id"]
            isOneToOne: false
            referencedRelation: "bug_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_reports: {
        Row: {
          code: string
          display_order: number
          environment: string | null
          found_in_version: string | null
          id: string
          project_id: string
          severity: Database["public"]["Enums"]["bug_severity"]
          state: Database["public"]["Enums"]["bug_state"]
        }
        Insert: {
          code: string
          display_order?: number
          environment?: string | null
          found_in_version?: string | null
          id?: string
          project_id: string
          severity?: Database["public"]["Enums"]["bug_severity"]
          state?: Database["public"]["Enums"]["bug_state"]
        }
        Update: {
          code?: string
          display_order?: number
          environment?: string | null
          found_in_version?: string | null
          id?: string
          project_id?: string
          severity?: Database["public"]["Enums"]["bug_severity"]
          state?: Database["public"]["Enums"]["bug_state"]
        }
        Relationships: [
          {
            foreignKeyName: "bug_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          badge_media_id: string | null
          credential_id: string | null
          credential_url: string | null
          display_order: number
          expires_on: string | null
          id: string
          issued_on: string | null
          issuer: string
          name: string
          visible: boolean
        }
        Insert: {
          badge_media_id?: string | null
          credential_id?: string | null
          credential_url?: string | null
          display_order?: number
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer: string
          name: string
          visible?: boolean
        }
        Update: {
          badge_media_id?: string | null
          credential_id?: string | null
          credential_url?: string | null
          display_order?: number
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer?: string
          name?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cert_badge_fk"
            columns: ["badge_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          body: string
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          locale: Database["public"]["Enums"]["locale"]
          name: string
          page_path: string | null
          spam_score: number | null
          state: Database["public"]["Enums"]["contact_state"]
          subject: string | null
          user_agent: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          name: string
          page_path?: string | null
          spam_score?: number | null
          state?: Database["public"]["Enums"]["contact_state"]
          subject?: string | null
          user_agent?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          name?: string
          page_path?: string | null
          spam_score?: number | null
          state?: Database["public"]["Enums"]["contact_state"]
          subject?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      content_audit: {
        Row: {
          action: string
          actor_name: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          summary: string
        }
        Insert: {
          action: string
          actor_name: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          summary?: string
        }
        Update: {
          action?: string
          actor_name?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          summary?: string
        }
        Relationships: []
      }
      education: {
        Row: {
          display_order: number
          end_date: string | null
          id: string
          institution: string
          location: string | null
          start_date: string | null
          visible: boolean
        }
        Insert: {
          display_order?: number
          end_date?: string | null
          id?: string
          institution: string
          location?: string | null
          start_date?: string | null
          visible?: boolean
        }
        Update: {
          display_order?: number
          end_date?: string | null
          id?: string
          institution?: string
          location?: string | null
          start_date?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      education_translations: {
        Row: {
          degree_title: string
          education_id: string
          field: string | null
          id: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md: string | null
        }
        Insert: {
          degree_title: string
          education_id: string
          field?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
        }
        Update: {
          degree_title?: string
          education_id?: string
          field?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_translations_education_id_fkey"
            columns: ["education_id"]
            isOneToOne: false
            referencedRelation: "education"
            referencedColumns: ["id"]
          },
        ]
      }
      experience: {
        Row: {
          company: string
          company_hidden: boolean
          display_order: number
          employment_type: Database["public"]["Enums"]["employment_type"]
          end_date: string | null
          id: string
          is_current: boolean
          location: string | null
          nda: boolean
          start_date: string
          visible: boolean
        }
        Insert: {
          company: string
          company_hidden?: boolean
          display_order?: number
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          nda?: boolean
          start_date: string
          visible?: boolean
        }
        Update: {
          company?: string
          company_hidden?: boolean
          display_order?: number
          employment_type?: Database["public"]["Enums"]["employment_type"]
          end_date?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          nda?: boolean
          start_date?: string
          visible?: boolean
        }
        Relationships: []
      }
      experience_translations: {
        Row: {
          experience_id: string
          highlights_md: string | null
          id: string
          locale: Database["public"]["Enums"]["locale"]
          role_title: string
          summary_md: string
        }
        Insert: {
          experience_id: string
          highlights_md?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          role_title: string
          summary_md?: string
        }
        Update: {
          experience_id?: string
          highlights_md?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          role_title?: string
          summary_md?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_translations_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experience"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          bucket: string
          byte_size: number
          checksum: string | null
          created_at: string
          dominant_color: string | null
          height: number | null
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          bucket?: string
          byte_size?: number
          checksum?: string | null
          created_at?: string
          dominant_color?: string | null
          height?: number | null
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          bucket?: string
          byte_size?: number
          checksum?: string | null
          created_at?: string
          dominant_color?: string | null
          height?: number | null
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_translations: {
        Row: {
          alt_text: string
          caption: string | null
          id: string
          locale: Database["public"]["Enums"]["locale"]
          media_id: string
        }
        Insert: {
          alt_text: string
          caption?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          media_id: string
        }
        Update: {
          alt_text?: string
          caption?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_translations_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      profile: {
        Row: {
          available_for_work: boolean
          avatar_media_id: string | null
          email_public: string | null
          full_name: string
          id: number
          location: string | null
          phone_public: string | null
          resume_media_id: string | null
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          available_for_work?: boolean
          avatar_media_id?: string | null
          email_public?: string | null
          full_name: string
          id?: number
          location?: string | null
          phone_public?: string | null
          resume_media_id?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          available_for_work?: boolean
          avatar_media_id?: string | null
          email_public?: string | null
          full_name?: string
          id?: number
          location?: string | null
          phone_public?: string | null
          resume_media_id?: string | null
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_avatar_fk"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_resume_fk"
            columns: ["resume_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_translations: {
        Row: {
          bio_md: string
          headline: string
          id: string
          locale: Database["public"]["Enums"]["locale"]
          profile_id: number
          seo_description: string | null
          seo_title: string | null
          summary_md: string | null
        }
        Insert: {
          bio_md?: string
          headline: string
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          profile_id: number
          seo_description?: string | null
          seo_title?: string | null
          summary_md?: string | null
        }
        Update: {
          bio_md?: string
          headline?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          profile_id?: number
          seo_description?: string | null
          seo_title?: string | null
          summary_md?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_translations_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profile"
            referencedColumns: ["id"]
          },
        ]
      }
      project_highlights: {
        Row: {
          display_order: number
          id: string
          kind: string
          locale: Database["public"]["Enums"]["locale"]
          project_id: string
          text: string
        }
        Insert: {
          display_order?: number
          id?: string
          kind?: string
          locale: Database["public"]["Enums"]["locale"]
          project_id: string
          text: string
        }
        Update: {
          display_order?: number
          id?: string
          kind?: string
          locale?: Database["public"]["Enums"]["locale"]
          project_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_highlights_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          caption_en: string | null
          caption_tr: string | null
          display_order: number
          id: string
          media_id: string
          project_id: string
          role: Database["public"]["Enums"]["project_media_role"]
        }
        Insert: {
          caption_en?: string | null
          caption_tr?: string | null
          display_order?: number
          id?: string
          media_id: string
          project_id: string
          role?: Database["public"]["Enums"]["project_media_role"]
        }
        Update: {
          caption_en?: string | null
          caption_tr?: string | null
          display_order?: number
          id?: string
          media_id?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_media_role"]
        }
        Relationships: [
          {
            foreignKeyName: "project_media_media_fk"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_taxonomy: {
        Row: {
          display_order: number
          project_id: string
          term_id: string
        }
        Insert: {
          display_order?: number
          project_id: string
          term_id: string
        }
        Update: {
          display_order?: number
          project_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_taxonomy_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_taxonomy_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "taxonomy_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      project_translations: {
        Row: {
          challenges_md: string | null
          id: string
          impact_md: string | null
          lessons_md: string | null
          locale: Database["public"]["Enums"]["locale"]
          overview_md: string | null
          project_id: string
          role_title: string | null
          seo_description: string | null
          seo_title: string | null
          summary: string
          test_coverage_md: string | null
          test_strategy_md: string | null
          testing_scope_md: string | null
          title: string
          translation_status: Database["public"]["Enums"]["content_status"]
        }
        Insert: {
          challenges_md?: string | null
          id?: string
          impact_md?: string | null
          lessons_md?: string | null
          locale: Database["public"]["Enums"]["locale"]
          overview_md?: string | null
          project_id: string
          role_title?: string | null
          seo_description?: string | null
          seo_title?: string | null
          summary: string
          test_coverage_md?: string | null
          test_strategy_md?: string | null
          testing_scope_md?: string | null
          title: string
          translation_status?: Database["public"]["Enums"]["content_status"]
        }
        Update: {
          challenges_md?: string | null
          id?: string
          impact_md?: string | null
          lessons_md?: string | null
          locale?: Database["public"]["Enums"]["locale"]
          overview_md?: string | null
          project_id?: string
          role_title?: string | null
          seo_description?: string | null
          seo_title?: string | null
          summary?: string
          test_coverage_md?: string | null
          test_strategy_md?: string | null
          testing_scope_md?: string | null
          title?: string
          translation_status?: Database["public"]["Enums"]["content_status"]
        }
        Relationships: [
          {
            foreignKeyName: "project_translations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          classification: Database["public"]["Enums"]["project_classification"]
          company: string | null
          company_hidden: boolean
          cover_media_id: string | null
          created_at: string
          display_order: number
          end_date: string | null
          external_url: string | null
          featured: boolean
          github_url: string | null
          id: string
          is_ongoing: boolean
          nda: boolean
          published_at: string | null
          role_title: string | null
          slug: string
          start_date: string | null
          status: Database["public"]["Enums"]["content_status"]
          supported: boolean
          updated_at: string
          visible: boolean
        }
        Insert: {
          classification: Database["public"]["Enums"]["project_classification"]
          company?: string | null
          company_hidden?: boolean
          cover_media_id?: string | null
          created_at?: string
          display_order?: number
          end_date?: string | null
          external_url?: string | null
          featured?: boolean
          github_url?: string | null
          id?: string
          is_ongoing?: boolean
          nda?: boolean
          published_at?: string | null
          role_title?: string | null
          slug: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          supported?: boolean
          updated_at?: string
          visible?: boolean
        }
        Update: {
          classification?: Database["public"]["Enums"]["project_classification"]
          company?: string | null
          company_hidden?: boolean
          cover_media_id?: string | null
          created_at?: string
          display_order?: number
          end_date?: string | null
          external_url?: string | null
          featured?: boolean
          github_url?: string | null
          id?: string
          is_ongoing?: boolean
          nda?: boolean
          published_at?: string | null
          role_title?: string | null
          slug?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["content_status"]
          supported?: boolean
          updated_at?: string
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_fk"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      service_translations: {
        Row: {
          description_md: string
          id: string
          locale: Database["public"]["Enums"]["locale"]
          outcome_md: string | null
          service_id: string
          title: string
        }
        Insert: {
          description_md?: string
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          outcome_md?: string | null
          service_id: string
          title: string
        }
        Update: {
          description_md?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          outcome_md?: string | null
          service_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_translations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          display_order: number
          icon: string | null
          id: string
          slug: string
          visible: boolean
        }
        Insert: {
          display_order?: number
          icon?: string | null
          id?: string
          slug: string
          visible?: boolean
        }
        Update: {
          display_order?: number
          icon?: string | null
          id?: string
          slug?: string
          visible?: boolean
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          analytics_id: string | null
          contact_notification_email: string | null
          default_locale: Database["public"]["Enums"]["locale"]
          feature_flags: Json
          id: number
          primary_cta: string | null
        }
        Insert: {
          analytics_id?: string | null
          contact_notification_email?: string | null
          default_locale?: Database["public"]["Enums"]["locale"]
          feature_flags?: Json
          id?: number
          primary_cta?: string | null
        }
        Update: {
          analytics_id?: string | null
          contact_notification_email?: string | null
          default_locale?: Database["public"]["Enums"]["locale"]
          feature_flags?: Json
          id?: number
          primary_cta?: string | null
        }
        Relationships: []
      }
      site_settings_translations: {
        Row: {
          id: string
          locale: Database["public"]["Enums"]["locale"]
          meta_description: string
          og_image_media_id: string | null
          settings_id: number
          site_tagline: string
          site_title: string
        }
        Insert: {
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          meta_description?: string
          og_image_media_id?: string | null
          settings_id: number
          site_tagline?: string
          site_title: string
        }
        Update: {
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          meta_description?: string
          og_image_media_id?: string | null
          settings_id?: number
          site_tagline?: string
          site_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_translations_settings_id_fkey"
            columns: ["settings_id"]
            isOneToOne: false
            referencedRelation: "site_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sst_og_fk"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          display_order: number
          id: string
          label_en: string
          label_tr: string
          slug: string
          visible: boolean
        }
        Insert: {
          display_order?: number
          id?: string
          label_en: string
          label_tr: string
          slug: string
          visible?: boolean
        }
        Update: {
          display_order?: number
          id?: string
          label_en?: string
          label_tr?: string
          slug?: string
          visible?: boolean
        }
        Relationships: []
      }
      skills: {
        Row: {
          category_id: string
          display_order: number
          featured: boolean
          id: string
          label: string
          proficiency: number | null
          visible: boolean
          years: number | null
        }
        Insert: {
          category_id: string
          display_order?: number
          featured?: boolean
          id?: string
          label: string
          proficiency?: number | null
          visible?: boolean
          years?: number | null
        }
        Update: {
          category_id?: string
          display_order?: number
          featured?: boolean
          id?: string
          label?: string
          proficiency?: number | null
          visible?: boolean
          years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          display_order: number
          id: string
          label: string
          platform: string
          url: string
          visible: boolean
        }
        Insert: {
          display_order?: number
          id?: string
          label: string
          platform: string
          url: string
          visible?: boolean
        }
        Update: {
          display_order?: number
          id?: string
          label?: string
          platform?: string
          url?: string
          visible?: boolean
        }
        Relationships: []
      }
      sql_example_translations: {
        Row: {
          example_id: string
          explanation_md: string | null
          id: string
          locale: Database["public"]["Enums"]["locale"]
          title: string
        }
        Insert: {
          example_id: string
          explanation_md?: string | null
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          title: string
        }
        Update: {
          example_id?: string
          explanation_md?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sql_example_translations_example_id_fkey"
            columns: ["example_id"]
            isOneToOne: false
            referencedRelation: "sql_examples"
            referencedColumns: ["id"]
          },
        ]
      }
      sql_examples: {
        Row: {
          code: string
          dialect: string
          display_order: number
          id: string
          project_id: string
          query_sql: string
          sample_result: string | null
        }
        Insert: {
          code: string
          dialect?: string
          display_order?: number
          id?: string
          project_id: string
          query_sql: string
          sample_result?: string | null
        }
        Update: {
          code?: string
          dialect?: string
          display_order?: number
          id?: string
          project_id?: string
          query_sql?: string
          sample_result?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sql_examples_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_terms: {
        Row: {
          display_order: number
          icon: string | null
          id: string
          kind: Database["public"]["Enums"]["taxonomy_kind"]
          label_en: string
          label_tr: string
          slug: string
          visible: boolean
        }
        Insert: {
          display_order?: number
          icon?: string | null
          id?: string
          kind: Database["public"]["Enums"]["taxonomy_kind"]
          label_en: string
          label_tr: string
          slug: string
          visible?: boolean
        }
        Update: {
          display_order?: number
          icon?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["taxonomy_kind"]
          label_en?: string
          label_tr?: string
          slug?: string
          visible?: boolean
        }
        Relationships: []
      }
      test_scenario_translations: {
        Row: {
          expected_md: string
          id: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md: string | null
          preconditions_md: string | null
          scenario_id: string
          steps_md: string
          title: string
        }
        Insert: {
          expected_md?: string
          id?: string
          locale: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
          preconditions_md?: string | null
          scenario_id: string
          steps_md?: string
          title: string
        }
        Update: {
          expected_md?: string
          id?: string
          locale?: Database["public"]["Enums"]["locale"]
          notes_md?: string | null
          preconditions_md?: string | null
          scenario_id?: string
          steps_md?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_scenario_translations_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "test_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      test_scenarios: {
        Row: {
          automated: boolean
          code: string
          display_order: number
          id: string
          kind: Database["public"]["Enums"]["test_kind"]
          priority: Database["public"]["Enums"]["test_priority"]
          project_id: string
        }
        Insert: {
          automated?: boolean
          code: string
          display_order?: number
          id?: string
          kind?: Database["public"]["Enums"]["test_kind"]
          priority?: Database["public"]["Enums"]["test_priority"]
          project_id: string
        }
        Update: {
          automated?: boolean
          code?: string
          display_order?: number
          id?: string
          kind?: Database["public"]["Enums"]["test_kind"]
          priority?: Database["public"]["Enums"]["test_priority"]
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_scenarios_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_audit: {
        Args: {
          p_actor_name: string
          p_entity_type: string
          p_entity_id: string
          p_action: string
          p_summary: string
        }
        Returns: undefined
      }
      admin_project_transition: {
        Args: { p_id: string; p_transition: string; p_actor_name?: string }
        Returns: {
          id: string
          status: Database["public"]["Enums"]["content_status"]
          visible: boolean
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      project_is_public: { Args: { p_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      admin_role: "owner" | "editor"
      bug_severity: "blocker" | "critical" | "major" | "minor" | "trivial"
      bug_state: "open" | "fixed" | "wont_fix" | "deferred" | "by_design"
      contact_state: "new" | "read" | "replied" | "archived" | "spam"
      content_status: "draft" | "published" | "archived"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "freelance"
        | "internship"
      http_method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
      locale: "tr" | "en"
      project_classification:
        | "professional"
        | "supported"
        | "personal"
        | "qa_lab"
      project_media_role: "cover" | "gallery" | "diagram" | "screenshot"
      taxonomy_kind: "platform" | "tool" | "test_type" | "industry"
      test_kind:
        | "functional"
        | "regression"
        | "integration"
        | "e2e"
        | "api"
        | "performance"
        | "security"
        | "accessibility"
        | "exploratory"
      test_priority: "p0" | "p1" | "p2" | "p3"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["owner", "editor"],
      bug_severity: ["blocker", "critical", "major", "minor", "trivial"],
      bug_state: ["open", "fixed", "wont_fix", "deferred", "by_design"],
      contact_state: ["new", "read", "replied", "archived", "spam"],
      content_status: ["draft", "published", "archived"],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "freelance",
        "internship",
      ],
      http_method: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      locale: ["tr", "en"],
      project_classification: [
        "professional",
        "supported",
        "personal",
        "qa_lab",
      ],
      project_media_role: ["cover", "gallery", "diagram", "screenshot"],
      taxonomy_kind: ["platform", "tool", "test_type", "industry"],
      test_kind: [
        "functional",
        "regression",
        "integration",
        "e2e",
        "api",
        "performance",
        "security",
        "accessibility",
        "exploratory",
      ],
      test_priority: ["p0", "p1", "p2", "p3"],
    },
  },
} as const

