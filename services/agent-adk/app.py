#!/usr/bin/env python3
"""
Léxia Agent Service (FastAPI) - versão simples e segura
- Recebe mensagens do webhook via HTTP (POST /chat)
- Deduplica por message_id (evita respostas duplicadas)
- Mantém sessão em memória (debug). Em produção, use DB no webhook.
"""

import os
import logging
from typing import Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

# -----------------------------------------------------------------------------
# LOGGING
# -----------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("lexia-agent")

# -----------------------------------------------------------------------------
# FASTAPI
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Léxia Agent",
    version="2.0.0",
    description="Agent HTTP service for WhatsApp webhook"
)

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")
AGENT_INSTRUCTION = os.getenv(
    "AGENT_INSTRUCTION",
    "Você é um atendente da Léxia Veículos. Responda de forma amigável e profissional."
)
DPK_SHARED_SECRET = os.getenv("DPK_SHARED_SECRET", "")

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def assert_secret(x_dpk_secret: Optional[str]):
    if not DPK_SHARED_SECRET:
        return
    if not x_dpk_secret or x_dpk_secret != DPK_SHARED_SECRET:
        raise HTTPException(status_code=401, detail="unauthorized")

def now_iso() -> str:
    return datetime.now().isoformat()

# -----------------------------------------------------------------------------
# MODELS
# -----------------------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    text: str

    # IMPORTANTÍSSIMO p/ WhatsApp: ID único da mensagem (messages[0].id)
    message_id: Optional[str] = None

    # opcional
    user_id: Optional[str] = None
    timestamp: Optional[str] = None

    # opcional: se você quiser mandar contexto do DB pro agente
    # (recomendado: o webhook monta isso)
    context: Optional[str] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    timestamp: str
    message_id: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# -----------------------------------------------------------------------------
# STATE (em memória) - DEBUG / simples
# Em produção: dedupe ideal no DB/Redis pelo webhook.
# -----------------------------------------------------------------------------
processed_message_ids = set()
sessions: Dict[str, Dict[str, Any]] = {}


def get_session(session_id: str) -> Dict[str, Any]:
    if session_id not in sessions:
        sessions[session_id] = {
            "id": session_id,
            "created_at": now_iso(),
            "messages": []
        }
    return sessions[session_id]


async def generate_reply(session_id: str, user_text: str, context: Optional[str]) -> str:
    """
    Aqui você pluga o ADK/Gemini de verdade depois.
    Por enquanto deixo bem simples, mas já pronto pra você trocar.
    """
    # Exemplo: usar contexto se vier do webhook
    if context:
        return (
            f"{AGENT_INSTRUCTION}\n\n"
            f"Contexto:\n{context}\n\n"
            f"Usuário: {user_text}\n\n"
            "Resposta: Obrigado! Já entendi e vou te ajudar com isso."
        )

    return f"Obrigado pela mensagem! Você disse: '{user_text}'. Como posso te ajudar agora?"


# -----------------------------------------------------------------------------
# ENDPOINTS
# -----------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", timestamp=now_iso(), version="2.0.0")


@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, x_dpk_secret: Optional[str] = Header(default=None)):
    assert_secret(x_dpk_secret)
    
    # validação mínima
    if not req.session_id or not req.text:
        raise HTTPException(status_code=400, detail="session_id and text are required")

    # -------------------------
    # DEDUPE por message_id
    # -------------------------
    if req.message_id:
        if req.message_id in processed_message_ids:
            # IMPORTANTE: não gere outra resposta (isso evita duplicar)
            logger.info(f"[DEDUPE] Duplicate message_id={req.message_id} session={req.session_id}")
            return ChatResponse(
                session_id=req.session_id,
                reply="",  # vazio (webhook deve ignorar reply vazio)
                timestamp=now_iso(),
                message_id=req.message_id
            )
        processed_message_ids.add(req.message_id)

    # -------------------------
    # sessão (debug)
    # -------------------------
    session = get_session(req.session_id)
    session["messages"].append({"role": "user", "content": req.text, "ts": now_iso(), "message_id": req.message_id})

    logger.info(f"[CHAT] session={req.session_id} message_id={req.message_id} text={req.text}")

    # -------------------------
    # gerar resposta
    # -------------------------
    reply = await generate_reply(req.session_id, req.text, req.context)

    session["messages"].append({"role": "assistant", "content": reply, "ts": now_iso(), "message_id": req.message_id})

    return ChatResponse(
        session_id=req.session_id,
        reply=reply,
        timestamp=now_iso(),
        message_id=req.message_id
    )


@app.get("/sessions/{session_id}")
async def get_session_debug(session_id: str):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]


@app.get("/")
async def root():
    return {
        "service": "Léxia Agent",
        "version": "2.0.0",
        "model": GEMINI_MODEL,
        "status": "running",
        "endpoints": {"health": "/health", "chat": "/chat"}
    }


# -----------------------------------------------------------------------------
# RUN LOCAL (Cloud Run usa uvicorn via cmd normalmente)
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
