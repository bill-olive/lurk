# ---------------------------------------------------------------------------
# Lurk PII Service (Python + Presidio) — Multi-stage Dockerfile
# ---------------------------------------------------------------------------

# Stage 1: Build dependencies and download spaCy model
FROM python:3.12-slim AS builder

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc g++ && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download spaCy model (use sm for faster builds — swap to lg in prod if needed)
RUN python -m spacy download en_core_web_sm

# Stage 2: Production (copy from builder's full site-packages)
FROM python:3.12-slim AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all installed packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY src/ ./src/

# Create non-root user
RUN useradd --create-home appuser
USER appuser

ENV PORT=8080
ENV PYTHONUNBUFFERED=1
ENV SPACY_MODEL=en_core_web_sm
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
