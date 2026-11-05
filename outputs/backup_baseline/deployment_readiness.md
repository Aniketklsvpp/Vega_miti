# VEGA-MITI — Deployment Readiness & Hosting Strategy

**Date:** November 5, 2026  
**Document Status:** Deployment Architecture Specification & Pre-Flight Checklist  

---

## 1. Recommended Production Architecture

| Tier | Recommended Platform | Alternative | Runtime / Environment |
|---|---|---|---|
| **Frontend** | **Vercel** | Netlify / Cloudflare Pages | Node.js 20+ (Static Single-Page Application via Vite build) |
| **Backend** | **Render** (Web Service) | Railway / Fly.io / GCP Cloud Run | Python 3.12 (FastAPI + Uvicorn) |
| **Storage / Data** | Embedded Git repo data | AWS S3 / Cloudflare R2 | Static CSV metadata and pre-trained `.joblib` model artifacts |

---

## 2. Configuration & Environment Variables

### A. Frontend Configuration
- **Build Command:** `npm run build` (runs `tsc -b && vite build`)
- **Output Directory:** `dist`
- **Environment Variables:**
  - `VITE_API_URL`: The production URL of the deployed FastAPI backend (e.g., `https://vega-miti-api.onrender.com`).
  - When `VITE_API_URL` is set, `frontend/src/api/swarmApi.ts` routes all live requests directly to the production backend.
  - When running locally in development, `vite.config.ts` proxies `/api` requests to `http://127.0.0.1:8000`.

### B. Backend Configuration
- **Start Command:**
  ```bash
  uvicorn src.backend.app:app --host 0.0.0.0 --port $PORT --workers 2
  ```
- **Requirements File:** `requirements.txt`
  - `numpy>=1.26.0`
  - `pandas>=2.0.0`
  - `scikit-learn>=1.3.0`
  - `joblib>=1.3.0`
  - `fastapi>=0.110.0`
  - `uvicorn>=0.28.0`
  - `requests>=2.31.0`
- **CORS Allowed Origins:**
  In `src/backend/app.py` and `src/swarm_api.py`, `CORSMiddleware` is configured with `allow_origins=["*"]`, `allow_credentials=True`, `allow_methods=["*"]`, and `allow_headers=["*"]`, enabling smooth cross-origin communication from any Vercel/Netlify preview or production domain.

---

## 3. Step-by-Step Deployment Instructions

### Step 1: Deploy Backend (Render / Railway)
1. Link the GitHub repository: `https://github.com/Aniketklsvpp/Vega_miti.git` (branch: `main`).
2. Select **Python 3** environment.
3. Set **Build Command:** `pip install -r requirements.txt`.
4. Set **Start Command:** `uvicorn src.backend.app:app --host 0.0.0.0 --port $PORT`.
5. Verify deployment:
   - Request `GET https://<your-backend-app>/api/health`.
   - Verify HTTP 200 and response:
     ```json
     {
       "status": "success",
       "data": {
         "service": "VEGA-MITI Unified Backend",
         "status": "HEALTHY",
         "hydrology_calibrated_stations": 22
       }
     }
     ```

### Step 2: Deploy Frontend (Vercel)
1. Import repository into Vercel.
2. Set **Root Directory:** `frontend`.
3. Set **Framework Preset:** Vite.
4. Set **Build Command:** `npm run build`.
5. Set **Output Directory:** `dist`.
6. Add Environment Variable:
   - `VITE_API_URL`: `https://<your-backend-app>` (without trailing slash).
7. Deploy.
8. Verify frontend loads, connects to the live backend, and does NOT fall back to demo mode.

---

## 4. Pre-Flight Verification Checklist

- [x] Backend dependencies in `requirements.txt` are complete and pinned.
- [x] Pre-trained model artifacts exist in `models/` or are generated dynamically.
- [x] Historical replay timelines (`src/historical_replay.py`) are self-contained in code.
- [x] No hardcoded machine paths (`C:\Users\...`) exist in codebase.
- [x] No private secrets or credentials are hardcoded or committed.
- [x] CORS middleware is configured for cross-origin frontend communication.
- [x] `VITE_API_URL` environment variable properly consumed by frontend.
- [x] Frontend production bundle built with 0 errors (`npm run build` exits 0).
- [ ] **External deployment execution:** Awaiting user approval before deploying to external cloud hosting.

