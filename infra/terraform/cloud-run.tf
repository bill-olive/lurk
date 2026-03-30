# ---------------------------------------------------------------------------
# Lurk Platform — Cloud Run Service Definitions
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# api-gateway  (Node / Express — public-facing)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "api_gateway" {
  name     = "${local.env_prefix}-api-gateway"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.api_gateway.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.environment == "production" ? 20 : 5
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.api_gateway_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "AGENT_ORCHESTRATOR_URL"
        value = "https://${local.env_prefix}-agent-orchestrator-${data.google_project.current.number}.${var.region}.run.app"
      }
      env {
        name  = "LLM_GATEWAY_URL"
        value = "https://${local.env_prefix}-llm-gateway-${data.google_project.current.number}.${var.region}.run.app"
      }
      env {
        name  = "PII_SERVICE_URL"
        value = "https://${local.env_prefix}-pii-service-${data.google_project.current.number}.${var.region}.run.app"
      }
      env {
        name  = "PUBSUB_AGENT_TRIGGERS_TOPIC"
        value = google_pubsub_topic.agent_triggers.id
      }
      env {
        name  = "PUBSUB_NOTIFICATIONS_TOPIC"
        value = google_pubsub_topic.notifications.id
      }
      env {
        name  = "PUBSUB_AUDIT_EVENTS_TOPIC"
        value = google_pubsub_topic.audit_events.id
      }
      env {
        name  = "ARTIFACT_CONTENT_BUCKET"
        value = google_storage_bucket.artifact_content.name
      }
      env {
        name = "FIREBASE_SERVICE_ACCOUNT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "60s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# agent-orchestrator  (Python / FastAPI — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "agent_orchestrator" {
  name     = "${local.env_prefix}-agent-orchestrator"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.agent_orchestrator.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.environment == "production" ? 30 : 5
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.agent_orchestrator_image

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "LLM_GATEWAY_URL"
        value = "https://${local.env_prefix}-llm-gateway-${data.google_project.current.number}.${var.region}.run.app"
      }
      env {
        name  = "PII_SERVICE_URL"
        value = "https://${local.env_prefix}-pii-service-${data.google_project.current.number}.${var.region}.run.app"
      }
      env {
        name  = "PUBSUB_AGENT_TRIGGERS_TOPIC"
        value = google_pubsub_topic.agent_triggers.id
      }
      env {
        name  = "PUBSUB_AUDIT_EVENTS_TOPIC"
        value = google_pubsub_topic.audit_events.id
      }
      env {
        name  = "PUBSUB_NOTIFICATIONS_TOPIC"
        value = google_pubsub_topic.notifications.id
      }
      env {
        name  = "CLOUD_TASKS_QUEUE"
        value = google_cloud_tasks_queue.agent_execution.id
      }
      env {
        name  = "ARTIFACT_CONTENT_BUCKET"
        value = google_storage_bucket.artifact_content.name
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "900s" # Agent runs can be long
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# llm-gateway  (Python / FastAPI — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "llm_gateway" {
  name     = "${local.env_prefix}-llm-gateway"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.llm_gateway.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.environment == "production" ? 20 : 5
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.llm_gateway_image

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.anthropic_api_key.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "OPENAI_API_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.openai_api_key.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "300s" # LLM calls can take a while
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# pii-service  (Python / FastAPI + Presidio — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "pii_service" {
  name     = "${local.env_prefix}-pii-service"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.pii_service.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.pii_service_image

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi" # Presidio + spaCy model needs RAM
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 30 # spaCy model load takes time
        period_seconds        = 10
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "120s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# migration-service  (Node / TypeScript — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "migration_service" {
  name     = "${local.env_prefix}-migration-service"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.migration_service.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.migration_service_image

      resources {
        limits = {
          cpu    = "2"
          memory = "2Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PUBSUB_MIGRATION_EVENTS_TOPIC"
        value = google_pubsub_topic.migration_events.id
      }
      env {
        name  = "PUBSUB_AUDIT_EVENTS_TOPIC"
        value = google_pubsub_topic.audit_events.id
      }
      env {
        name  = "MIGRATION_TASKS_QUEUE"
        value = google_cloud_tasks_queue.migration_tasks.id
      }
      env {
        name  = "ARTIFACT_CONTENT_BUCKET"
        value = google_storage_bucket.artifact_content.name
      }
      env {
        name  = "MIGRATION_TEMP_BUCKET"
        value = google_storage_bucket.migration_temp.name
      }
      env {
        name = "FIREBASE_SERVICE_ACCOUNT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "900s" # Migrations can be long-running
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# notification-service  (Node / TypeScript — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "notification_service" {
  name     = "${local.env_prefix}-notification-service"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.notification_service.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.notification_service_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PUBSUB_NOTIFICATIONS_TOPIC"
        value = google_pubsub_topic.notifications.id
      }
      env {
        name = "FIREBASE_SERVICE_ACCOUNT"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.firebase_service_account.secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "60s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# tts-service  (Node / TypeScript — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "tts_service" {
  name     = "${local.env_prefix}-tts-service"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.tts_service.email

    scaling {
      min_instance_count = 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = var.tts_service_image

      resources {
        limits = {
          cpu    = "2"
          memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "TTS_AUDIO_BUCKET"
        value = google_storage_bucket.tts_audio.name
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "120s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# audit-service  (Node / TypeScript — internal)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "audit_service" {
  name     = "${local.env_prefix}-audit-service"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  template {
    service_account = google_service_account.audit_service.email

    scaling {
      min_instance_count = var.environment == "production" ? 1 : 0
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.audit_service_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8080
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "60s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# web-admin  (Next.js — public-facing)
# ---------------------------------------------------------------------------

resource "google_cloud_run_v2_service" "web_admin" {
  name     = "${local.env_prefix}-web-admin"
  location = var.region
  labels   = local.labels

  ingress = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.web_admin.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.environment == "production" ? 10 : 3
    }

    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.web_admin_image

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 3000
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "NEXT_PUBLIC_API_URL"
        value = google_cloud_run_v2_service.api_gateway.uri
      }
      env {
        name  = "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        value = var.project_id
      }

      startup_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 5
      }

      liveness_probe {
        http_get {
          path = "/api/health"
          port = 3000
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }

    timeout = "60s"
  }

  depends_on = [google_project_service.apis]
}

# ---------------------------------------------------------------------------
# Data source — current project (used for URL construction)
# ---------------------------------------------------------------------------

data "google_project" "current" {
  project_id = var.project_id
}
