// ---------------------------------------------------------------------------
// Feature Flags and Operational Controls (PRD Section 17)
// ---------------------------------------------------------------------------

/**
 * All feature flags defined in the Lurk PRD.
 * Typed as a strict interface so consumers get autocomplete and compile-time
 * safety when reading/writing flags.
 */
export interface FeatureFlags {
  // -- Platform --
  mac_app_enabled: boolean;
  ios_app_enabled: boolean;
  chrome_extension_enabled: boolean;
  /** Extension without Mac app. */
  chrome_standalone_mode_enabled: boolean;

  // -- Capture --
  artifact_capture_enabled: boolean;
  capture_gdocs_enabled: boolean;
  capture_gmail_enabled: boolean;
  capture_calendar_enabled: boolean;
  capture_github_enabled: boolean;
  capture_figma_enabled: boolean;
  capture_crm_enabled: boolean;
  /** Meeting capture. */
  capture_media_enabled: boolean;
  capture_filesystem_enabled: boolean;
  capture_ide_enabled: boolean;

  // -- Meeting capture --
  meeting_capture_enabled: boolean;
  meeting_local_transcription_enabled: boolean;
  meeting_cloud_transcription_fallback: boolean;
  meeting_auto_summary_enabled: boolean;
  /** OpenAI TTS for meeting summaries. */
  meeting_voice_narration_enabled: boolean;

  // -- Agent system --
  agents_enabled: boolean;
  personal_agents_enabled: boolean;
  team_agents_enabled: boolean;
  org_agents_enabled: boolean;
  function_agents_enabled: boolean;
  voice_agents_enabled: boolean;
  calendar_agents_enabled: boolean;
  customer_health_agents_enabled: boolean;
  analytics_agents_enabled: boolean;
  yolo_mode_enabled: boolean;

  // -- PR system --
  pr_system_enabled: boolean;
  auto_merge_enabled: boolean;
  cross_ledger_forks_enabled: boolean;
  /** OpenAI TTS for PR summaries. */
  pr_voice_narration_enabled: boolean;

  // -- Agent marketplace and builder --
  agent_marketplace_enabled: boolean;
  custom_agent_builder_enabled: boolean;

  // -- Migration --
  migration_enabled: boolean;
  migration_api_import_enabled: boolean;
  /** Browserbase. */
  migration_agentic_crawl_enabled: boolean;
  migration_file_upload_enabled: boolean;
  migration_slack_enabled: boolean;
  migration_gdrive_enabled: boolean;
  migration_notion_enabled: boolean;
  migration_gmail_enabled: boolean;
  migration_jira_enabled: boolean;
  migration_github_enabled: boolean;

  // -- Cross-org --
  federation_enabled: boolean;
  guest_access_enabled: boolean;

  // -- Privacy --
  local_embeddings_enabled: boolean;
  server_pii_validation_enabled: boolean;
  redacted_content_storage_enabled: boolean;

  // -- Connectors --
  email_connector_enabled: boolean;
  slack_connector_enabled: boolean;
  webhook_connector_enabled: boolean;
  apns_connector_enabled: boolean;

  // -- Analytics --
  artifact_analytics_enabled: boolean;
  customer_health_dashboard_enabled: boolean;

  // -- Admin --
  admin_console_enabled: boolean;
  audit_bigquery_export_enabled: boolean;
}

/**
 * All feature flag keys as a union type, useful for dynamic flag lookups.
 */
export type FeatureFlagKey = keyof FeatureFlags;

// ---- Kill Switches ---------------------------------------------------------

/**
 * Kill switches that can immediately halt specific system components.
 * Parameterized switches (team_kill:{teamId}) are represented as
 * Record<string, boolean> at runtime; the static keys are listed here.
 */
export interface KillSwitches {
  /** Stop everything. */
  org_global_kill: boolean;
  /** Stop all agents. */
  org_agent_kill: boolean;
  /** Stop all capture. */
  org_capture_kill: boolean;
  /** Stop meeting capture. */
  org_meeting_capture_kill: boolean;
  /** Stop all migration. */
  org_migration_kill: boolean;
}

/**
 * Dynamic kill switches keyed by entity reference.
 * e.g. 'team_kill:team_abc', 'agent_kill:agent_xyz', 'user_kill:user_123'.
 */
export type DynamicKillSwitchKey =
  | `team_kill:${string}`
  | `agent_kill:${string}`
  | `artifact_type_kill:${string}`
  | `user_kill:${string}`
  | `federation_kill:${string}`;

export type DynamicKillSwitches = Record<DynamicKillSwitchKey, boolean>;
