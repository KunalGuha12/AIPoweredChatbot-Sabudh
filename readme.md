# 🩺 Sabudh Healthcare Assistant – RAG Chatbot

> **Ask questions in plain English, get grounded answers with citations.**  
> A domain-specific Retrieval-Augmented Generation (RAG) chatbot built for Sabudh’s healthcare handbooks, institutional policies, and educational material.

---

## 🌟 Key Features

- 🔍 **Domain-Aware Q&A:** Ask healthcare and policy questions in natural language and get answers grounded in Sabudh’s own documents.  
- 📚 **Retrieval‑Augmented Generation:** Combines dense semantic search (FAISS) with a large language model to minimize hallucinations.  
- 📎 **Source-Cited Responses:** Every answer comes with citation chips linking back to the exact document chunks used.  
- ⚙️ **Configurable RAG Pipeline:** Tune chunk size, overlap, and top‑k retrieval without changing core code.  
- 🌐 **Clean Web UI:** Responsive chat interface with a simple landing dashboard for quick onboarding.  
- 🚀 **Production‑Ready Architecture:** Modular FastAPI backend, separate ingestion and indexing flow, and clear environment-based configuration.

---

## 🧱 Tech Stack Breakdown

| Layer      | Tools & Frameworks                                    |
|-----------|--------------------------------------------------------|
| Frontend  | HTML5, CSS3, Vanilla JS                                |
| Backend   | Python, FastAPI, Uvicorn                               |
| NLP / RAG | SentenceTransformers (`all-MiniLM-L6-v2`), FAISS, LLM (Gemini) |
| Data      | PDF handbooks, policies, course notes (local files)    |
| Config    | `.env` (API keys, model settings, index paths)         |

---

## 🗺️ Project Layout

> High-level overview of the most important files and folders.

| Path / File        | Description                                                   |
|--------------------|---------------------------------------------------------------|
| `app.py`           | FastAPI application entrypoint (routes, startup hooks)       |
| `chatbot/`         | Core RAG logic: embeddings, retrieval, prompt construction   |
| `ingestion/`       | PDF parsing, cleaning, chunking, corpus build scripts        |
| `index/`           | FAISS index build/load utilities                             |
| `data/`            | Source documents (PDFs / processed text, usually .gitignored)|
| `static/`          | CSS, JavaScript, and images for the web UI                   |
| `templates/`       | HTML templates for landing page and chat interface           |
| `requirements.txt` | Python dependencies                                          |
| `README.md`        | You are here                                                 |

If you want to see the big picture, check the diagrams in the repo:

- `image/system.png` – High-level system architecture  
- `image/igestion.png` – PDF ingestion and indexing pipeline  
- `image/qa_flow.png` – Question → Answer sequence in the RAG pipeline  
- `image/retrival.png` – Retrieval accuracy by category  
- `image/latency.png` – Latency breakdown by component

---

## ⚙️ Getting Started
### 1️⃣ Clone the repository
git clone https://github.com/<your-username>/Healthcare-Ai-Chatbot.git
cd Healthcare-Ai-Chatbot

### 2️⃣ Set up a virtual environment

python -m venv .venv

Windows
.venv\Scripts\activate

macOS / Linux
source .venv/bin/activate

### 3️⃣ Install dependencies

pip install -r requirements.txt

### 4️⃣ Configure environment variables

Create a `.env` file in the project root:

GEMINI_API_KEY=your_gemini_api_key_here

EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2

TOP_K=3

CHUNK_SIZE=1000

CHUNK_OVERLAP=200
FAISS_INDEX_PATH=./index/faiss.index

### 5️⃣ Build the corpus and FAISS index
python ingestion/build_corpus.py # parses PDFs, cleans text, creates chunks
python index/build_faiss_index.py # embeds chunks and builds the FAISS index

> Run these again whenever you add or modify documents in `data/`.

### 6️⃣ Run the application

uvicorn app:app --reload

Open your browser at `http://127.0.0.1:8000` and start chatting.

---

## 📊 Evaluation Snapshot

### Retrieval Performance

The assistant was evaluated on a labelled test set of 23 queries:

- **Overall retrieval accuracy:** ~87%  
- **By category:**
  - Symptoms – 87.5%  
  - Treatments – 85.7%  
  - Policies – 100%  
  - Educational – 66.7%

Policies perform best because they are concise and well-structured, while educational questions often require multi‑step reasoning across multiple sections.

### Latency

Measured end‑to‑end from request to answer:

- **P50:** ~1.85 s  
- **P95:** ~2.55 s  
- **P99:** ~3.25 s  

Embedding + FAISS retrieval account for a few milliseconds; **LLM generation is the dominant cost**, suggesting that optimisation efforts should focus there (streaming, caching, smaller models).

---

## 🧪 RAG Configuration Highlights

Some key findings from sensitivity analysis:

- **Chunk size:**  
  - 500 chars → lower accuracy (fragmented context)  
  - **1000 chars → best accuracy (~87%)**  
  - 2000 chars → more context, but more noise and longer prompts  

- **Top‑k retrieval:**  
  - k = 1 → misses relevant context  
  - **k = 3 → best trade‑off of accuracy vs token usage**  
  - k = 5 → slight accuracy gain but more prompt bloat

---

## ⚖️ Limitations & Responsible Use

- ❗ The assistant is **not a doctor** and must **not** be used for diagnosis or emergency decisions.  
- Answers are bounded by the **quality and coverage of the ingested corpus**.  
- The LLM can still make mistakes; critical decisions require human review.  
- The UI should always display a disclaimer and offer a clear way for users to report incorrect or harmful answers.

---

## 🚧 Roadmap

Planned / potential improvements:

- 🔄 Continuous corpus updates with new clinical and educational material  
- 🧠 Hybrid retrieval (BM25 + dense) and re-ranking for complex queries  
- 👍 Feedback loop in the UI (thumbs up/down + comments) feeding into evaluation  
- 📉 Lower latency via smaller local LLMs or streaming responses  
- 📈 Admin analytics dashboard to track usage, accuracy, and latency over time

---

## 🙌 Acknowledgements

This project was developed as part of the **Sabudh Passion Project**.  
Thanks to mentors, faculty, and the Sabudh Foundation for guidance, infrastructure, and access to institutional documents.

---

> 💡 **Contributions welcome!**  
> Found a bug, have an idea, or want to extend the assistant?  
> Open an issue or submit a pull request and help improve the next iteration.


