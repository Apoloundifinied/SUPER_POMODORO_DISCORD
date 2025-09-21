from fastapi import FastAPI
import random
import json
app = FastAPI()

with open("frases.json", "r", encoding="utf-8") as f:
    data = json.load(f)
    frases = data["frases"]

@app.get("/")
def read_root():
    return {"mensagem": "API de Frases Motivacionais"}

# 🔹 Rota que retorna uma frase aleatória
@app.get("/frases")
def get_frase():
    frase_aleatoria = random.choice(frases)
    return {"frase": frase_aleatoria}

# 🔹 Rota com quantidade de frases aleatórias (opcional)
@app.get("/frases/{quantidade}")
def get_varias_frases(quantidade: int):
    return {"frases": random.sample(frases, min(quantidade, len(frases)))}
