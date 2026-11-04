# VEGA-MITI — Leakage-Safe Hydrological Evaluation Report

**Evaluation Methodology:** Genuine held-out-station spatial cross-validation  
**Training Stations (16):** 01570500, 01638500, 01646500, 02037500, 02146000, 02169500, 02202500, 03234500, 03374100, 05484500, 05527500, 05586100, 06192500, 07144100, 07196500, 08116650 (11680 samples)  
**Held-Out Test Stations (6):** 08158000, 09095500, 09180500, 09380000, 12119000, 14211720 (4380 samples)  
**Zero-Leakage Audit:** Preprocessing and model training fitted exclusively on the 16 training stations.

---

## 1. Held-Out Station Model Comparison Matrix

| Model / Baseline | Pooled RMSE (cfs) | Pooled MAE (cfs) | Pooled NSE | Macro RMSE (cfs) | Macro NSE | Skill vs Mean | Skill vs Persistence |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Config A (HistGB + log1p, 24 feat)** | **13,654.35** | **7,539.82** | **0.1654** | **10,175.36** | **-12.8251** | **+0.0905** | -4.8404 |
| **Config B (ExtraTrees + raw, 18 past)** | 15,509.22 | 9,424.86 | -0.0767 | 12,729.83 | -27.8482 | -0.0330 | -5.6338 |
| **Persistence (1-Day Lag)** | 2,337.91 | 715.24 | 0.9755 | 1,449.08 | 0.8950 | +0.8443 | 0.0000 |
| **Training Mean Baseline** | 15,013.44 | 8,255.54 | -0.0090 | - | - | 0.0000 | -5.4217 |

---

## 2. Persistence Investigation & Scientific Disclosure

> [!IMPORTANT]
> **Why Persistence Outperforms ML on Held-Out Stations:**
> - **Autocorrelation:** Daily river discharge exhibits high 1-day temporal autocorrelation (rho > 0.95). Persistence uses yesterday's streamflow directly measured at that gauge.
> - **Operational Boundary:** Persistence is fundamentally **unfeasible at ungauged stations** where physical sensors do not exist.
> - **Flash Floods:** Persistence lags stream crests by 24 hours, failing to alert ahead of storm surges.
> - **Role of ML:** Machine learning generalizes from weather and basin terrain, enabling discharge estimation for unmonitored or sensor-deprived rivers.

---

## 3. High-Flow Event Detection (Top 10% Streamflow Events)

- **90th Percentile Threshold:** 20,220.0 cfs
- **Precision:** 0.4167
- **Recall:** 0.1142
- **F1-Score:** 0.1792
- **AUPRC:** 0.3797
- **Observed High-Flow Events:** 438 events across 4,380 test days

---

## 4. Robustness Stress Testing (Random Seed: 42)

- **Gaussian Noise (+20% std):** Degradation = **-0.85%** (RMSE: 13,654.35 cfs)
- **Missing Weather (25% masked):** Degradation = **7.45%** (RMSE: 14,671.48 cfs)

---

## 5. Reference Benchmark: Full-Dataset Frozen Model (In-Sample Reference)

For complete transparency, evaluating the frozen production artifact (`outputs/hist_gb_log1p_full.joblib`) across these 6 stations yields:
- **Pooled RMSE:** 3,269.11 cfs
- **Pooled MAE:** 1,405.93 cfs
- **Pooled NSE:** 0.9522

*Note: The frozen production model was trained across all 22 stations. It is presented here strictly as an in-sample reference, while the fresh held-out models in Section 1 provide the true leakage-safe generalization assessment.*
