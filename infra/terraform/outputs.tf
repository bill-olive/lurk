# ---------------------------------------------------------------------------
# Lurk Platform — Terraform Outputs
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Cloud Run Service URLs
# ---------------------------------------------------------------------------

output "api_gateway_url" {
  description = "URL of the API Gateway Cloud Run service"
  value       = google_cloud_run_v2_service.api_gateway.uri
}

output "agent_orchestrator_url" {
  description = "URL of the Agent Orchestrator Cloud Run service"
  value       = google_cloud_run_v2_service.agent_orchestrator.uri
}

output "llm_gateway_url" {
  description = "URL of the LLM Gateway Cloud Run service"
  value       = google_cloud_run_v2_service.llm_gateway.uri
}

output "pii_service_url" {
  description = "URL of the PII Service Cloud Run service"
  value       = google_cloud_run_v2_service.pii_service.uri
}

output "migration_service_url" {
  description = "URL of the Migration Service Cloud Run service"
  value       = google_cloud_run_v2_service.migration_service.uri
}

output "notification_service_url" {
  description = "URL of the Notification Service Cloud Run service"
  value       = google_cloud_run_v2_service.notification_service.uri
}

output "tts_service_url" {
  description = "URL of the TTS Service Cloud Run service"
  value       = google_cloud_run_v2_service.tts_service.uri
}

output "audit_service_url" {
  description = "URL of the Audit Service Cloud Run service"
  value       = google_cloud_run_v2_service.audit_service.uri
}

output "web_admin_url" {
  description = "URL of the Web Admin Cloud Run service"
  value       = google_cloud_run_v2_service.web_admin.uri
}

# ---------------------------------------------------------------------------
# GCS Bucket Names
# ---------------------------------------------------------------------------

output "artifact_content_bucket" {
  description = "GCS bucket for artifact content"
  value       = google_storage_bucket.artifact_content.name
}

output "tts_audio_bucket" {
  description = "GCS bucket for TTS audio files"
  value       = google_storage_bucket.tts_audio.name
}

output "migration_temp_bucket" {
  description = "GCS bucket for temporary migration data"
  value       = google_storage_bucket.migration_temp.name
}

# ---------------------------------------------------------------------------
# Pub/Sub Topic Names
# ---------------------------------------------------------------------------

output "agent_triggers_topic" {
  description = "Pub/Sub topic for agent triggers"
  value       = google_pubsub_topic.agent_triggers.id
}

output "notifications_topic" {
  description = "Pub/Sub topic for notifications"
  value       = google_pubsub_topic.notifications.id
}

output "audit_events_topic" {
  description = "Pub/Sub topic for audit events"
  value       = google_pubsub_topic.audit_events.id
}

output "migration_events_topic" {
  description = "Pub/Sub topic for migration events"
  value       = google_pubsub_topic.migration_events.id
}

# ---------------------------------------------------------------------------
# Cloud Tasks Queue Names
# ---------------------------------------------------------------------------

output "agent_execution_queue" {
  description = "Cloud Tasks queue for agent execution"
  value       = google_cloud_tasks_queue.agent_execution.id
}

output "migration_tasks_queue" {
  description = "Cloud Tasks queue for migration tasks"
  value       = google_cloud_tasks_queue.migration_tasks.id
}

# ---------------------------------------------------------------------------
# Service Accounts
# ---------------------------------------------------------------------------

output "service_account_emails" {
  description = "Map of service name to service account email"
  value = {
    api_gateway          = google_service_account.api_gateway.email
    agent_orchestrator   = google_service_account.agent_orchestrator.email
    llm_gateway          = google_service_account.llm_gateway.email
    pii_service          = google_service_account.pii_service.email
    migration_service    = google_service_account.migration_service.email
    notification_service = google_service_account.notification_service.email
    tts_service          = google_service_account.tts_service.email
    audit_service        = google_service_account.audit_service.email
    web_admin            = google_service_account.web_admin.email
  }
}

# ---------------------------------------------------------------------------
# CDN
# ---------------------------------------------------------------------------

output "tts_cdn_ip" {
  description = "Global IP address for TTS CDN"
  value       = google_compute_global_forwarding_rule.tts_cdn.ip_address
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------

output "vpc_connector_id" {
  description = "Serverless VPC Access connector ID"
  value       = google_vpc_access_connector.connector.id
}

# ---------------------------------------------------------------------------
# Secret Manager Secret IDs
# ---------------------------------------------------------------------------

output "secret_ids" {
  description = "Map of secret name to Secret Manager secret ID"
  value = {
    anthropic_api_key        = google_secret_manager_secret.anthropic_api_key.secret_id
    openai_api_key           = google_secret_manager_secret.openai_api_key.secret_id
    firebase_service_account = google_secret_manager_secret.firebase_service_account.secret_id
  }
}
