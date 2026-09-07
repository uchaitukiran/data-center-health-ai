# ==============================================================================
# Data Center Health AI - Production Docker Image
# Multi-stage lightweight deployment container for cloud deployment (Render/AWS/GCP)
# ==============================================================================

FROM python:3.10-slim AS runner

# Prevent Python from writing .pyc files and buffer stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

# Install runtime system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install slim Python dependencies
COPY requirements-render.txt .
RUN pip install --no-cache-dir -r requirements-render.txt

# Copy application source code and artifacts
COPY config/ ./config/
COPY src/ ./src/
COPY webapp/ ./webapp/
COPY datacente_model/ ./datacente_model/
COPY artifacts/ ./artifacts/
COPY docs/ ./docs/
COPY data/ ./data/

# Create logs directory
RUN mkdir -p logs

EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start gunicorn with eventlet/gevent or flask runner
CMD ["sh", "-c", "python -m src.api.app"]
