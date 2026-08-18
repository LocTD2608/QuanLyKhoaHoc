# Configuration for RAG Chatbot

from core.config import settings

class RAGConfig:
    OPENAI_API_KEY = settings.OPENAI_API_KEY
    OPENAI_MODEL = settings.OPENAI_MODEL
    BATCH_SIZE = settings.RAG_BATCH_SIZE
