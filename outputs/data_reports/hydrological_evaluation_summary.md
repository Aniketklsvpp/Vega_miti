# DELTA-SWARM — Hydrological Evaluation Summary

**Model Configuration:** A  
**Evaluation Samples:** 4380 across 6 held-out stations  
**Held-out Stations:** 08158000, 09095500, 09180500, 09380000, 12119000, 14211720

## 1. Forecast Skill (Held-Out Stations)
- **RMSE:** 3,269.11 cfs
- **MAE:** 1,405.93 cfs
- **Normalized MAE (Mean):** 0.1625
- **Nash-Sutcliffe Efficiency (NSE):** 0.9522
- **Macro Station-Average RMSE:** 2,426.97 cfs

## 2. Baseline Comparison
- **Mean Baseline RMSE:** 15,013.44 cfs (Skill score: 0.7823)
- **Persistence Baseline RMSE:** 2,339.51 cfs (Skill score: -0.3973)

## 3. High-Flow Event Detection (90th Percentile)
- **Threshold Value:** 20,220.0 cfs
- **Precision:** 0.9086
- **Recall:** 0.8402
- **F1-Score:** 0.8731
- **AUPRC:** 0.9565
- **Events Detected:** 405 predicted / 438 actual

## 4. Robustness Stress Testing
- **Gaussian Noise Degradation:** 176.84% (RMSE: 9,050.18 cfs)
- **25% Missing Weather Degradation:** 23.29% (RMSE: 4,030.34 cfs)

## 5. Computational Efficiency
- **Latency:** 20.45 ms per 1,000 samples
- **Model Size:** 531.3 KB
