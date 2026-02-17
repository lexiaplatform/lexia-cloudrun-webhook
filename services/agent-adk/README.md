# Léxia Agent ADK Service

FastAPI service for AI agent processing using Google Gemini/Vertex AI.

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GEMINI_MODEL=gemini-2.5-pro
export GOOGLE_CLOUD_PROJECT=lexia-platform-486621

# Run server
python app.py
# or
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

### Test Endpoints

```bash
# Health check
curl http://localhost:8000/health

# Chat endpoint
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "wa_id_5511999999999",
    "text": "Olá, como vocês funcionam?"
  }'

# Get session details
curl http://localhost:8000/sessions/wa_id_5511999999999
```

## 📦 Docker

### Build

```bash
docker build -t lexia-agent-adk:latest .
```

### Run

```bash
docker run -p 8000:8000 \
  -e GEMINI_MODEL=gemini-2.5-pro \
  -e GOOGLE_CLOUD_PROJECT=lexia-platform-486621 \
  lexia-agent-adk:latest
```

## ☁️ Cloud Run Deployment

```bash
gcloud run deploy lexia-agent-adk \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GOOGLE_CLOUD_PROJECT=GOOGLE_CLOUD_PROJECT:latest \
  --set-secrets GEMINI_MODEL=GEMINI_MODEL:latest
```

## 📝 API Endpoints

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-17T00:00:00.000Z",
  "version": "1.0.0"
}
```

### POST /chat
Process user message and return AI response.

**Request:**
```json
{
  "session_id": "wa_id_5511999999999",
  "text": "Olá, como vocês funcionam?",
  "user_id": "optional_user_id",
  "timestamp": "optional_timestamp"
}
```

**Response:**
```json
{
  "session_id": "wa_id_5511999999999",
  "reply": "Resposta do agente...",
  "timestamp": "2026-02-17T00:00:00.000Z"
}
```

### GET /sessions/{session_id}
Get session details (for debugging).

**Response:**
```json
{
  "id": "wa_id_5511999999999",
  "created_at": "2026-02-17T00:00:00.000Z",
  "messages": [
    {
      "role": "user",
      "content": "Olá",
      "timestamp": "2026-02-17T00:00:00.000Z"
    },
    {
      "role": "assistant",
      "content": "Resposta do agente",
      "timestamp": "2026-02-17T00:00:00.000Z"
    }
  ]
}
```

## 🔒 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8000 | Server port |
| HOST | 0.0.0.0 | Server host |
| GOOGLE_CLOUD_PROJECT | lexia-platform-486621 | GCP project ID |
| GOOGLE_CLOUD_LOCATION | global | GCP location |
| GOOGLE_GENAI_USE_VERTEXAI | true | Use Vertex AI |
| GEMINI_MODEL | gemini-2.5-pro | Gemini model to use |
| AGENT_INSTRUCTION | (default) | Agent system instruction |
| APP_NAME | lexia | Application name |
| DATABASE_URL | (optional) | Database connection string |
| LOG_LEVEL | INFO | Logging level |

## 🔄 Integration with Webhook

The webhook service calls this agent via HTTP:

```python
# In webhook service
response = await httpx.post(
    f"{AGENT_URL}/chat",
    json={
        "session_id": wa_id,
        "text": user_message
    }
)
reply = response.json()["reply"]
```

## 📚 Architecture

- **Framework**: FastAPI
- **Server**: Uvicorn
- **AI Model**: Google Gemini (via Vertex AI)
- **Session Management**: In-memory (can be replaced with DB)
- **Deployment**: Cloud Run

## 🚀 Production Considerations

1. **Session Persistence**: Replace in-memory storage with Cloud Datastore/Firestore
2. **Error Handling**: Add comprehensive error handling and retries
3. **Rate Limiting**: Implement rate limiting for API endpoints
4. **Monitoring**: Add Cloud Logging and Cloud Trace integration
5. **Authentication**: Add authentication if needed
6. **Caching**: Implement caching for common responses

## 📞 Support

For issues or questions, check the main README.md in the repository root.
