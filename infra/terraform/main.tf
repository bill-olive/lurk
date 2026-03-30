# ---------------------------------------------------------------------------
# Lurk Platform — Main Terraform Configuration
# ---------------------------------------------------------------------------

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.30"
    }
  }

  backend "gcs" {
    # bucket is injected via -backend-config at init time
    prefix = "terraform/state"
  }
}

# ---------------------------------------------------------------------------
# Providers
# ---------------------------------------------------------------------------

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# Locals
# ---------------------------------------------------------------------------

locals {
  env_prefix = "lurk-${var.environment}"

  labels = {
    project     = "lurk"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ---------------------------------------------------------------------------
# Enable required APIs
# ---------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "secretmanager.googleapis.com",
    "pubsub.googleapis.com",
    "cloudtasks.googleapis.com",
    "vpcaccess.googleapis.com",
    "compute.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy         = false
}

# ---------------------------------------------------------------------------
# Networking — VPC & Serverless VPC Access Connector
# ---------------------------------------------------------------------------

resource "google_compute_network" "vpc" {
  name                    = "${local.env_prefix}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_compute_subnetwork" "private" {
  name          = "${local.env_prefix}-private"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  private_ip_google_access = true
}

resource "google_vpc_access_connector" "connector" {
  name          = "${local.env_prefix}-vpc-cx"
  region        = var.region
  ip_cidr_range = var.vpc_connector_cidr
  network       = google_compute_network.vpc.name

  min_instances = 2
  max_instances = 10

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# Firestore Database
# ---------------------------------------------------------------------------

resource "google_firestore_database" "main" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.firestore_location
  type        = "FIRESTORE_NATIVE"

  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# GCS Buckets
# ---------------------------------------------------------------------------

resource "google_storage_bucket" "artifact_content" {
  name     = "${local.env_prefix}-artifact-content"
  location = var.region
  labels   = local.labels

  uniform_bucket_level_access = true
  force_destroy               = var.environment == "staging"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket" "tts_audio" {
  name     = "${local.env_prefix}-tts-audio"
  location = var.region
  labels   = local.labels

  uniform_bucket_level_access = true
  force_destroy               = var.environment == "staging"

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Length"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

resource "google_storage_bucket" "migration_temp" {
  name     = "${local.env_prefix}-migration-temp"
  location = var.region
  labels   = local.labels

  uniform_bucket_level_access = true
  force_destroy               = true

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }
}

# ---------------------------------------------------------------------------
# Cloud CDN — backend bucket for TTS audio
# ---------------------------------------------------------------------------

resource "google_compute_backend_bucket" "tts_cdn" {
  name        = "${local.env_prefix}-tts-cdn"
  bucket_name = google_storage_bucket.tts_audio.name
  enable_cdn  = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    signed_url_cache_max_age_sec = 7200
  }
}

resource "google_compute_url_map" "tts_cdn" {
  name            = "${local.env_prefix}-tts-cdn-url-map"
  default_service = google_compute_backend_bucket.tts_cdn.id
}

resource "google_compute_target_http_proxy" "tts_cdn" {
  name    = "${local.env_prefix}-tts-cdn-proxy"
  url_map = google_compute_url_map.tts_cdn.id
}

resource "google_compute_global_forwarding_rule" "tts_cdn" {
  name       = "${local.env_prefix}-tts-cdn-fwd"
  target     = google_compute_target_http_proxy.tts_cdn.id
  port_range = "80"
}

# ---------------------------------------------------------------------------
# Pub/Sub Topics & Subscriptions
# ---------------------------------------------------------------------------

resource "google_pubsub_topic" "agent_triggers" {
  name   = "${local.env_prefix}-agent-triggers"
  labels = local.labels

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_topic" "notifications" {
  name   = "${local.env_prefix}-notifications"
  labels = local.labels

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_topic" "audit_events" {
  name   = "${local.env_prefix}-audit-events"
  labels = local.labels

  message_retention_duration = "604800s" # 7 days for compliance

  depends_on = [google_project_service.apis]
}

resource "google_pubsub_topic" "migration_events" {
  name   = "${local.env_prefix}-migration-events"
  labels = local.labels

  message_retention_duration = "86400s"

  depends_on = [google_project_service.apis]
}

# Dead-letter topic for failed messages
resource "google_pubsub_topic" "dead_letter" {
  name   = "${local.env_prefix}-dead-letter"
  labels = local.labels

  depends_on = [google_project_service.apis]
}

# Push subscriptions — each target Cloud Run service
resource "google_pubsub_subscription" "agent_triggers_push" {
  name  = "${local.env_prefix}-agent-triggers-push"
  topic = google_pubsub_topic.agent_triggers.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.agent_orchestrator.uri}/pubsub/agent-triggers"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 10
  }
}

resource "google_pubsub_subscription" "notifications_push" {
  name  = "${local.env_prefix}-notifications-push"
  topic = google_pubsub_topic.notifications.id

  ack_deadline_seconds = 60

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.notification_service.uri}/pubsub/notifications"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "300s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

resource "google_pubsub_subscription" "audit_events_push" {
  name  = "${local.env_prefix}-audit-events-push"
  topic = google_pubsub_topic.audit_events.id

  ack_deadline_seconds = 60

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.audit_service.uri}/pubsub/audit-events"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  retry_policy {
    minimum_backoff = "5s"
    maximum_backoff = "300s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 10
  }
}

resource "google_pubsub_subscription" "migration_events_push" {
  name  = "${local.env_prefix}-migration-events-push"
  topic = google_pubsub_topic.migration_events.id

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.migration_service.uri}/pubsub/migration-events"

    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.dead_letter.id
    max_delivery_attempts = 5
  }
}

# ---------------------------------------------------------------------------
# Cloud Tasks Queues
# ---------------------------------------------------------------------------

resource "google_cloud_tasks_queue" "agent_execution" {
  name     = "${local.env_prefix}-agent-execution"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 50
    max_concurrent_dispatches = 20
  }

  retry_config {
    max_attempts       = 5
    min_backoff        = "10s"
    max_backoff        = "300s"
    max_doublings      = 4
    max_retry_duration = "3600s"
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_tasks_queue" "migration_tasks" {
  name     = "${local.env_prefix}-migration-tasks"
  location = var.region

  rate_limits {
    max_dispatches_per_second = 10
    max_concurrent_dispatches = 5
  }

  retry_config {
    max_attempts       = 3
    min_backoff        = "30s"
    max_backoff        = "600s"
    max_doublings      = 3
    max_retry_duration = "7200s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# Secret Manager
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret" "anthropic_api_key" {
  secret_id = "${local.env_prefix}-anthropic-api-key"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "openai_api_key" {
  secret_id = "${local.env_prefix}-openai-api-key"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "firebase_service_account" {
  secret_id = "${local.env_prefix}-firebase-service-account"
  labels    = local.labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# IAM — Service Accounts
# ---------------------------------------------------------------------------

resource "google_service_account" "api_gateway" {
  account_id   = "${local.env_prefix}-api-gw"
  display_name = "Lurk API Gateway (${var.environment})"
}

resource "google_service_account" "agent_orchestrator" {
  account_id   = "${local.env_prefix}-agent-orch"
  display_name = "Lurk Agent Orchestrator (${var.environment})"
}

resource "google_service_account" "llm_gateway" {
  account_id   = "${local.env_prefix}-llm-gw"
  display_name = "Lurk LLM Gateway (${var.environment})"
}

resource "google_service_account" "pii_service" {
  account_id   = "${local.env_prefix}-pii-svc"
  display_name = "Lurk PII Service (${var.environment})"
}

resource "google_service_account" "migration_service" {
  account_id   = "${local.env_prefix}-migration"
  display_name = "Lurk Migration Service (${var.environment})"
}

resource "google_service_account" "notification_service" {
  account_id   = "${local.env_prefix}-notif-svc"
  display_name = "Lurk Notification Service (${var.environment})"
}

resource "google_service_account" "tts_service" {
  account_id   = "${local.env_prefix}-tts-svc"
  display_name = "Lurk TTS Service (${var.environment})"
}

resource "google_service_account" "audit_service" {
  account_id   = "${local.env_prefix}-audit-svc"
  display_name = "Lurk Audit Service (${var.environment})"
}

resource "google_service_account" "web_admin" {
  account_id   = "${local.env_prefix}-web-admin"
  display_name = "Lurk Web Admin (${var.environment})"
}

resource "google_service_account" "pubsub_invoker" {
  account_id   = "${local.env_prefix}-pubsub-inv"
  display_name = "Lurk Pub/Sub Invoker (${var.environment})"
}

# ---------------------------------------------------------------------------
# IAM Bindings — Firestore access
# ---------------------------------------------------------------------------

resource "google_project_iam_member" "firestore_readers" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.migration_service.email,
    google_service_account.notification_service.email,
    google_service_account.audit_service.email,
    google_service_account.web_admin.email,
  ])

  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${each.key}"
}

# ---------------------------------------------------------------------------
# IAM Bindings — Secret Manager access
# ---------------------------------------------------------------------------

resource "google_secret_manager_secret_iam_member" "anthropic_key_access" {
  for_each = toset([
    google_service_account.llm_gateway.email,
  ])

  secret_id = google_secret_manager_secret.anthropic_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.key}"
}

resource "google_secret_manager_secret_iam_member" "openai_key_access" {
  for_each = toset([
    google_service_account.llm_gateway.email,
  ])

  secret_id = google_secret_manager_secret.openai_api_key.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.key}"
}

resource "google_secret_manager_secret_iam_member" "firebase_sa_access" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.notification_service.email,
    google_service_account.web_admin.email,
  ])

  secret_id = google_secret_manager_secret.firebase_service_account.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${each.key}"
}

# ---------------------------------------------------------------------------
# IAM Bindings — GCS bucket access
# ---------------------------------------------------------------------------

resource "google_storage_bucket_iam_member" "artifact_content_writers" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.migration_service.email,
  ])

  bucket = google_storage_bucket.artifact_content.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${each.key}"
}

resource "google_storage_bucket_iam_member" "tts_audio_writer" {
  bucket = google_storage_bucket.tts_audio.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.tts_service.email}"
}

resource "google_storage_bucket_iam_member" "tts_audio_public_read" {
  bucket = google_storage_bucket.tts_audio.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket_iam_member" "migration_temp_writer" {
  bucket = google_storage_bucket.migration_temp.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.migration_service.email}"
}

# ---------------------------------------------------------------------------
# IAM Bindings — Pub/Sub publish access
# ---------------------------------------------------------------------------

resource "google_pubsub_topic_iam_member" "agent_triggers_publisher" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
  ])

  topic  = google_pubsub_topic.agent_triggers.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${each.key}"
}

resource "google_pubsub_topic_iam_member" "notifications_publisher" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.notification_service.email,
  ])

  topic  = google_pubsub_topic.notifications.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${each.key}"
}

resource "google_pubsub_topic_iam_member" "audit_events_publisher" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.migration_service.email,
  ])

  topic  = google_pubsub_topic.audit_events.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${each.key}"
}

resource "google_pubsub_topic_iam_member" "migration_events_publisher" {
  for_each = toset([
    google_service_account.migration_service.email,
    google_service_account.api_gateway.email,
  ])

  topic  = google_pubsub_topic.migration_events.id
  role   = "roles/pubsub.publisher"
  member = "serviceAccount:${each.key}"
}

# Pub/Sub invoker can call Cloud Run services
resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  for_each = {
    agent_orchestrator   = google_cloud_run_v2_service.agent_orchestrator.name
    notification_service = google_cloud_run_v2_service.notification_service.name
    audit_service        = google_cloud_run_v2_service.audit_service.name
    migration_service    = google_cloud_run_v2_service.migration_service.name
  }

  project  = var.project_id
  location = var.region
  name     = each.value
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

# ---------------------------------------------------------------------------
# IAM Bindings — Cloud Tasks
# ---------------------------------------------------------------------------

resource "google_project_iam_member" "tasks_enqueuer" {
  for_each = toset([
    google_service_account.api_gateway.email,
    google_service_account.agent_orchestrator.email,
    google_service_account.migration_service.email,
  ])

  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${each.key}"
}

# ---------------------------------------------------------------------------
# Public access for api-gateway and web-admin
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service_iam_member" "api_gateway_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api_gateway.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_admin_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web_admin.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
