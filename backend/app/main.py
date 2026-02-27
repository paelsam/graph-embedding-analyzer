
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import numpy as np
from fastapi.middleware.cors import CORSMiddleware
from .utils.rdpg_svd import truncated_svd, embedding_dimension, compute_ll_for_q

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PolarizationRequest(BaseModel):
    adj_matrix: List[List[float]]
    k: int = None # Optional custom k

@app.post("/api/polarization")
async def calculate_polarization(request: PolarizationRequest):
    try:
        A = np.array(request.adj_matrix)
        
        # 1. Compute truncated SVD
        n = A.shape[0]
        
        # Determine k
        if request.k is not None and request.k > 0:
            k_val = min(request.k, n) # Ensure k doesn't exceed n
        else:
            k_val = n # Default to full rank as per previous user change
        
        # We need singular values.
        S_k = truncated_svd(A, k=k_val)
        
        # 2. Estimate embedding dimension d_hat
        d_hat = embedding_dimension(S_k)
        
        return {"polarization": int(d_hat)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "RDPG+SVD Analysis Backend Running"}
