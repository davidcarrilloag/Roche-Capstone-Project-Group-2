# Backend image for the Roche Scientist Assistant.
# Build context is the repo root (see docker-compose.yml) so we can copy the
# shared requirements.txt that lives at the root.
FROM python:3.11-slim

WORKDIR /app

# System deps occasionally needed by sentence-transformers / chromadb.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# requirements.txt lives at the repo root (build context root).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only the backend source into the image.
COPY backend/ .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
