# ---------------------------------------------------------------------------
# Lurk Platform — Terraform Variables
# ---------------------------------------------------------------------------

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary GCP region for all resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (staging | production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "domain" {
  description = "Custom domain for the platform (e.g. lurk.example.com)"
  type        = string
  default     = ""
}

variable "alert_email" {
  description = "Email address for operational alerts"
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Container image tags — set per deployment
# ---------------------------------------------------------------------------

variable "api_gateway_image" {
  description = "Container image for api-gateway"
  type        = string
  default     = "gcr.io/PROJECT/api-gateway:latest"
}

variable "agent_orchestrator_image" {
  description = "Container image for agent-orchestrator"
  type        = string
  default     = "gcr.io/PROJECT/agent-orchestrator:latest"
}

variable "llm_gateway_image" {
  description = "Container image for llm-gateway"
  type        = string
  default     = "gcr.io/PROJECT/llm-gateway:latest"
}

variable "pii_service_image" {
  description = "Container image for pii-service"
  type        = string
  default     = "gcr.io/PROJECT/pii-service:latest"
}

variable "migration_service_image" {
  description = "Container image for migration-service"
  type        = string
  default     = "gcr.io/PROJECT/migration-service:latest"
}

variable "notification_service_image" {
  description = "Container image for notification-service"
  type        = string
  default     = "gcr.io/PROJECT/notification-service:latest"
}

variable "tts_service_image" {
  description = "Container image for tts-service"
  type        = string
  default     = "gcr.io/PROJECT/tts-service:latest"
}

variable "audit_service_image" {
  description = "Container image for audit-service"
  type        = string
  default     = "gcr.io/PROJECT/audit-service:latest"
}

variable "web_admin_image" {
  description = "Container image for web-admin"
  type        = string
  default     = "gcr.io/PROJECT/web-admin:latest"
}

# ---------------------------------------------------------------------------
# Scaling & resource limits
# ---------------------------------------------------------------------------

variable "cloud_run_max_instances" {
  description = "Default max instances for Cloud Run services"
  type        = number
  default     = 10
}

variable "cloud_run_min_instances" {
  description = "Default min instances (0 = scale-to-zero)"
  type        = number
  default     = 0
}

# ---------------------------------------------------------------------------
# Networking
# ---------------------------------------------------------------------------

variable "vpc_connector_cidr" {
  description = "CIDR range for Serverless VPC Access connector"
  type        = string
  default     = "10.8.0.0/28"
}

# ---------------------------------------------------------------------------
# Firebase / Firestore
# ---------------------------------------------------------------------------

variable "firestore_location" {
  description = "Firestore multi-region location"
  type        = string
  default     = "nam5"
}
