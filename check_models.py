import google.generativeai as genai
from dotenv import load_dotenv
import os

# Load your API key from .env
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("🔍 Available Gemini Models:")
for m in genai.list_models():
    print(m.name)
