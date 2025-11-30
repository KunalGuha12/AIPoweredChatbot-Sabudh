# chatbot/chat_agent.py
import os
import sys
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import google.generativeai as genai

# ✅ Fix Python import path so "ingestion" module is found
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ingestion.utils_ingestion import load_metadata

# Load environment variables
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure Gemini
genai.configure(api_key=GEMINI_API_KEY)

# Load embedding model (same as ingestion)
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
model = SentenceTransformer(EMBEDDING_MODEL)

# Paths to FAISS and metadata
INDEX_PATH = "index/sabudh_faiss.index"
META_PATH = "index/sabudh_faiss_metadata.json"

# Load FAISS index and metadata
index = faiss.read_index(INDEX_PATH)
metadata = load_metadata(META_PATH)

def embed_query(query: str):
    """Convert user query into normalized embedding vector."""
    q_emb = model.encode([query], convert_to_numpy=True).astype("float32")
    faiss.normalize_L2(q_emb)
    return q_emb

def retrieve_context(query: str, top_k: int = 3):
    """Retrieve top relevant chunks from FAISS."""
    q_emb = embed_query(query)
    D, I = index.search(q_emb, top_k)
    contexts = []
    for idx in I[0]:
        if idx >= 0:
            contexts.append(metadata[idx]["text"])
    return "\n\n".join(contexts)

def generate_answer(query: str):
    """Generate the final answer using Gemini with retrieved context."""
    context = retrieve_context(query)
    prompt = f"""
You are a helpful AI healthcare assistant.
Answer the user's question using only the context below.

Context:
{context}

Question:
{query}

Answer:
"""
    try:
        response = genai.GenerativeModel("models/gemini-2.5-pro").generate_content(prompt)


        return response.text
    except Exception as e:
        return f"⚠️ Error generating answer: {str(e)}"

if __name__ == "__main__":
    print("🤖 Sabudh Healthcare Chatbot is ready! Type 'exit' to quit.\n")
    while True:
        user_query = input("👤 Ask your healthcare question: ")
        if user_query.strip().lower() == "exit":
            print("👋 Exiting chatbot. Stay healthy!")
            break
        answer = generate_answer(user_query)
        print(f"\n🤖 Chatbot: {answer}\n")
