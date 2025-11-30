# app.py
from fastapi import FastAPI, Request, UploadFile, File, BackgroundTasks, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import os, shutil, json, time
from dotenv import load_dotenv

load_dotenv()


# ---------- Models ----------
class ChatRequest(BaseModel):
    question: str

class IngestRequest(BaseModel):
    path: str
    chunk_size: int = 1000
    overlap: int = 200

# ---------- App ----------
app = FastAPI(title="Sabudh • AI Healthcare Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# static + templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_RAW = os.path.join(PROJECT_ROOT, "data", "raw")
INDEX_DIR = os.path.join(PROJECT_ROOT, "index")

# MATCH main_ingestion.py OUTPUT HERE
FAISS_INDEX_PATH = os.path.join(INDEX_DIR, "sabudh_faiss.index")
METADATA_PATH = os.path.join(INDEX_DIR, "sabudh_faiss_metadata.json")

Path(DATA_RAW).mkdir(parents=True, exist_ok=True)
Path(INDEX_DIR).mkdir(parents=True, exist_ok=True)

try:
    from ingestion.main_ingestion import process_pdf
except:
    process_pdf = None

try:
    from ingestion.utils_ingestion import extract_pages_from_pdf, build_faiss_index, save_metadata
except:
    extract_pages_from_pdf = build_faiss_index = save_metadata = None

FAISS_INDEX = None
EMBEDDER = None
QUERY_COUNTER: Dict[str, Any] = {"today": 0}

def load_vector_system():
    """Load SentenceTransformer and FAISS index once on startup."""
    global FAISS_INDEX, EMBEDDER
    try:
        from sentence_transformers import SentenceTransformer
        import faiss

        EMBEDDER = SentenceTransformer("all-MiniLM-L6-v2")
        if os.path.exists(FAISS_INDEX_PATH):
            FAISS_INDEX = faiss.read_index(FAISS_INDEX_PATH)
            print("FAISS index loaded.")
        else:
            print("FAISS index not found. Run ingestion first.")
    except Exception as e:
        print("Vector load error:", e)

@app.on_event("startup")
def startup_event():
    load_vector_system()
    today = datetime.now().strftime("%Y-%m-%d")
    QUERY_COUNTER["today"] = 0
    QUERY_COUNTER["last_reset"] = today

# ---------- UI ----------
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve landing + chat UI."""
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "app_title": "Sabudh • AI Healthcare Assistant",
            "queries_today": QUERY_COUNTER.get("today", 0),
        },
    )

# ---------- Chat ----------
@app.post("/api/chat")
async def chat_with_bot(payload: ChatRequest):
    """Chat endpoint used by script.js (fetch /api/chat)."""
    question = payload.question.strip()
    if not question:
        return {"answer": "Please enter a question."}

    QUERY_COUNTER["today"] = QUERY_COUNTER.get("today", 0) + 1

    if EMBEDDER is None or FAISS_INDEX is None:
        return {"answer": "⚠ Ingestion not done. Upload and ingest documents first."}

    import numpy as np
    q_embed = EMBEDDER.encode([question])
    D, I = FAISS_INDEX.search(np.array(q_embed).astype("float32"), k=3)

    if not os.path.exists(METADATA_PATH):
        return {"answer": "⚠ No metadata found. Run ingestion first."}

    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        meta = json.load(f)

    retrieved_chunks = "\n\n".join(
        [meta[i]["text"] for i in I[0] if i < len(meta)]
    )

    try:
        from google import genai

        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        prompt = f"""
You are a professional healthcare assistant.
Answer briefly in 3–4 lines. Keep it medically accurate.

Question: {question}

Context from documents:
{retrieved_chunks}
"""
        resp = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        answer = resp.text.strip()
    except Exception as e:
        answer = f"⚠ Error calling model: {str(e)}"

    return {"answer": answer}

# ---------- Dashboard stats ----------
@app.get("/api/dashboard/stats")
async def api_dashboard_stats():
    docs = 0
    chunks = 0
    recent = []

    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
            chunks = len(meta)
            files = list({m.get("source", "Unknown") for m in meta})
            docs = len(files)
            recent = files[-5:]
        except Exception:
            pass

    return {
        "docs": docs,
        "chunks": chunks,
        "queries_today": QUERY_COUNTER.get("today", 0),
        "recent": recent,
    }

# ---------- Sources ----------
@app.get("/api/sources")
async def api_sources():
    out = []
    if os.path.exists(METADATA_PATH):
        try:
            with open(METADATA_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)

            by_file: Dict[str, list] = {}
            for m in meta:
                src = m.get("source", "Unknown")
                by_file.setdefault(src, []).append(m)

            for src, items in by_file.items():
                sample = items[0]["text"][:240] + "..."
                out.append(
                    {"name": src, "summary": sample, "chunks": len(items)}
                )
        except Exception:
            pass
    return out

# ---------- Upload ----------
@app.post("/api/ingest/upload")
async def api_ingest_upload(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "No file provided")

    filename = os.path.basename(file.filename)
    save_path = os.path.join(DATA_RAW, filename)

    try:
        with open(save_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        return {"ok": True, "path": save_path}
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {str(e)}")

# ---------- Ingestion ----------
def _run_ingestion_sync(file_path: str, chunk_size: int = 1000, overlap: int = 200):
    try:
        if process_pdf:
            process_pdf(file_path, chunk_size=chunk_size, overlap=overlap)
            load_vector_system()
            return

        if extract_pages_from_pdf and build_faiss_index:
            pages = extract_pages_from_pdf(file_path)
            # match our FAISS_INDEX_PATH
            build_faiss_index(pages, FAISS_INDEX_PATH)
            load_vector_system()
            return
    except Exception as e:
        print("Ingestion error:", e)

@app.post("/api/ingest/run")
async def api_ingest_run(payload: IngestRequest, background_tasks: BackgroundTasks):
    file_path = payload.path
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(404, "File not found")

    background_tasks.add_task(
        _run_ingestion_sync,
        file_path,
        payload.chunk_size,
        payload.overlap,
    )
    return {"ok": True, "message": "Ingestion started"}

# ---------- Health ----------
@app.get("/api/ping")
async def api_ping():
    return {
        "status": "ok",
        "time": time.time(),
        "vector_ready": FAISS_INDEX is not None,
        "queries_today": QUERY_COUNTER.get("today", 0),
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
