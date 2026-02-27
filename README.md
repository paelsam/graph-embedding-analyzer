# Graph Embedding Analyzer

A web application for generating, visualizing, and analyzing **Stochastic Block Model (SBM)** graphs. It applies the **Random Dot Product Graph (RDPG)** framework together with **Singular Value Decomposition (SVD)** to estimate the latent embedding dimension $\hat{d}$ of a network, which serves as a measure of structural polarization.


## Features

- **SBM Graph Generation** – Configure the number of nodes $n$, blocks $k$, per-block sizes, and connection probabilities (global $p_{in}$/$p_{out}$ scalars or a full $k \times k$ probability matrix).
- **Interactive Visualization** – Powered by [Sigma.js](https://www.sigmajs.org/) and [Graphology](https://graphology.github.io/). Supports node click-highlighting of neighbors, drag-and-drop repositioning, and four layout algorithms: *Block Grouped*, *ForceAtlas2*, *Circular*, and *Random*.
- **Polarization Analysis** – Extracts the adjacency matrix, sends it to a FastAPI backend, and estimates the optimal embedding dimension $\hat{d}$ via the profile likelihood method over the SVD spectrum.
- **Configuration History** – Auto-saves and manually saves graph configurations; any previous state can be restored.
- **Persistent Settings** – Last-used configuration is stored in `localStorage` and reloaded on next visit.
- **Dark / Light Theme** – Toggle between dark and light UI themes.



## Getting Started

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.9

### 1 · Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 2 · Frontend

```bash
npm install
npm run dev
```

The app is available at `http://localhost:5173`. Vite automatically proxies all `/api` requests to the backend at `http://127.0.0.1:8000`.

---

## How It Works

1. **Graph Generation** – An SBM graph is sampled with $n$ nodes partitioned into $k$ blocks. Each pair of nodes $(i, j)$ from blocks $a$ and $b$ is connected independently with probability $P_{ab}$.

2. **Polarization Calculation**

   - The adjacency matrix $A \in \{0,1\}^{n \times n}$ is extracted from the current graph.
   - A (truncated) SVD is computed: $A \approx U \Sigma V^\top$, yielding singular values $\sigma_1 \geq \sigma_2 \geq \cdots \geq \sigma_p$.
   - The **profile likelihood method** selects the cut-point $\hat{d}$ that maximises the log-likelihood of partitioning the singular value sequence into two Gaussian populations. $\hat{d}$ estimates the number of latent dimensions in the RDPG, reflecting the degree of community structure (polarization) in the network.

---

## References

- Anastasi, Sage, and Giulio Dalla Riva. ["Measuring changes in polarisation using Singular Value Decomposition of network graphs."](https://drive.google.com/file/d/15OkVOD19RoQDbbkugbyJAKcjaggS7kYP/view?usp=drive_link)
- ["Single Network Models — Random Dot Product Graph (RDPG)"](https://docs.neurodata.io/graph-stats-book/representations/ch5/single-network-models_RDPG.html) — *Graph Stats Book*, NeuroData, Johns Hopkins University.

