#!/usr/bin/env python3
"""
Léxia Agent ADK - FastAPI Service
Integração com Gemini/Vertex AI para processamento de mensagens
"""

import os
import logging
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Léxia Agent ADK",
    description="Agent service for Léxia WhatsApp webhook",
    version="1.0.0"
)

# ============================================================================
# MODELS
# ============================================================================

class ChatRequest(BaseModel):
    """Chat request from webhook"""
    session_id: str
    text: str
    user_id: Optional[str] = None
    timestamp: Optional[str] = None


class ChatResponse(BaseModel):
    """Chat response to webhook"""
    session_id: str
    reply: str
    timestamp: str


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    timestamp: str
    version: str


# ============================================================================
# CONFIGURATION
# ============================================================================

# Gemini/Vertex AI Configuration
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT", "lexia-platform-486621")
GOOGLE_CLOUD_LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
GOOGLE_GENAI_USE_VERTEXAI = os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "true").lower() == "true"

# Agent Configuration
AGENT_INSTRUCTION = os.getenv(
    "AGENT_INSTRUCTION",
    "Você é um atendente da Léxia Veículos. Responda de forma amigável e profissional."
)
APP_NAME = os.getenv("APP_NAME", "lexia")

logger.info(f"Agent initialized with model: {GEMINI_MODEL}")
logger.info(f"GCP Project: {GOOGLE_CLOUD_PROJECT}")
logger.info(f"Using Vertex AI: {GOOGLE_GENAI_USE_VERTEXAI}")

# ============================================================================
# AGENT INITIALIZATION
# ============================================================================

# Session storage (in-memory for now, can be replaced with DB)
sessions = {}


def get_or_create_session(session_id: str):
    """Get or create a session"""
    if session_id not in sessions:
        sessions[session_id] = {
            "id": session_id,
            "created_at": datetime.now().isoformat(),
            "messages": []
        }
    return sessions[session_id]


async def process_message(session_id: str, user_message: str) -> str:
    """
    Process user message and generate reply using Gemini
    
    This is a simplified implementation. In production, you would:
    1. Use proper ADK framework
    2. Implement session persistence
    3. Add error handling and retries
    4. Integrate with actual Vertex AI Agent
    """
    try:
        # Get or create session
        session = get_or_create_session(session_id)
        
        # Add user message to session
        session["messages"].append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now().isoformat()
        })
        
        logger.info(f"Processing message for session {session_id}: {user_message}")
        
        # TODO: Integrate with actual Gemini API
        # For now, return a placeholder response
        reply = f"Obrigado pela mensagem: '{user_message}'. Estou processando sua solicitação."
        
        # Add assistant response to session
        session["messages"].append({
            "role": "assistant",
            "content": reply,
            "timestamp": datetime.now().isoformat()
        })
        
        return reply
        
    except Exception as e:
        logger.error(f"Error processing message: {str(e)}")
        raise


# ============================================================================
# ENDPOINTS
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="ok",
        timestamp=datetime.now().isoformat(),
        version="1.0.0"
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint - process user message and return reply
    
    Expected request:
    {
        "session_id": "wa_id_5511999999999",
        "text": "Olá, como vocês funcionam?"
    }
    
    Response:
    {
        "session_id": "wa_id_5511999999999",
        "reply": "Resposta do agente...",
        "timestamp": "2026-02-17T00:00:00.000Z"
    }
    """
    try:
        # Validate request
        if not request.session_id or not request.text:
            raise HTTPException(status_code=400, detail="session_id and text are required")
        
        # Process message
        reply = await process_message(request.session_id, request.text)
        
        # Return response
        return ChatResponse(
            session_id=request.session_id,
            reply=reply,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get session details (for debugging)"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Léxia Agent ADK",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "chat": "/chat",
            "sessions": "/sessions/{session_id}"
        }
    }


# ============================================================================
# STARTUP/SHUTDOWN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Startup event"""
    logger.info("Agent ADK service started")
    logger.info(f"Model: {GEMINI_MODEL}")
    logger.info(f"Instruction: {AGENT_INSTRUCTION}")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("Agent ADK service shutting down")


# ============================================================================
# RUN
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )
