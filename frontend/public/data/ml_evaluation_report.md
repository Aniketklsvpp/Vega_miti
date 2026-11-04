# VEGA_MITI — ML EVALUATION & BASELINE FREEZE REPORT

**Challenge:** FLOODCAST — River Discharge Prediction  
**Team:** Vega_miti  
**Validation Strategy:** 5-Fold Station-Grouped Cross-Validation (`GroupKFold`)  
**Evaluation Dataset:** `data/processed/train.csv` (16,060 daily observations across 22 river stations)  
**Dataset Coverage:** 2022-01-01 to 2023-12-31  

---

## 1. PRESERVED BASELINE CONFIGURATIONS

Two production configurations have been frozen and saved in `outputs/`:

### Configuration A (Primary: Gradient Boosted Non-Linear Flow)
- **Model:** `HistGradientBoostingRegressor`
- **Target Transformation:** $\log(1 + y)$ target scale, inverted via $\max(0, \exp(\hat{y}) - 1)$
- **Feature Set:** Full 24 features (including same-day weather and rolling hydrological memory)
- **Artifact:** `outputs/hist_gb_log1p_full.joblib`
- **Grouped CV Performance:**
  - Overall RMSE: **9,320.98 cfs**
  - Extreme-Event RMSE (Top 10% per station): **22,211.47 cfs**
  - MAE: **4,257.86 cfs**
  - $R^2$: **0.3870**
  - Composite Competition Score: **11,239.53**

### Configuration B (Conservative: Past-Only Random Walk / Antecedent Tree Ensemble)
- **Model:** `ExtraTreesRegressor` (100 trees, max depth 12)
- **Target Transformation:** Raw discharge (direct $y$)
- **Feature Set:** Past-only 18 features (strictly $t-1$ lags, $3\text{d}/7\text{d}/14\text{d}$ rolling sums, catchment area, elevation, seasonality; zero same-day weather leakage)
- **Artifact:** `outputs/extra_trees_raw_past_only.joblib`
- **Grouped CV Performance:**
  - Overall RMSE: **9,505.16 cfs**
  - Extreme-Event RMSE (Top 10% per station): **21,701.64 cfs**
  - MAE: **4,944.96 cfs**
  - $R^2$: **0.3625**
  - Composite Competition Score: **11,308.97**

---

## 2. AUDIT & VERIFICATION RESULTS

1. **Station Leakage Check**:
   - `GroupKFold(n_splits=5)` was verified across 20 training stations (4 stations held out per fold).
   - $\text{Train Folds} \cap \text{Validation Fold} = \emptyset$ in all 5 folds.
   - Zero station memorization: `station_id` and date strings are stripped prior to feature engineering and matrix construction.

2. **Data Source Reconciliation**:
   - Automated acquisition queries encountered HTTP 429 rate limits from Open-Meteo.
   - The fallback logic in `src/data_acquisition.py` routed 100% of the 22 stations in `train.csv` to NASA POWER global reanalysis.
   - Soil moisture across all 22 stations uniformly represents NASA POWER `GWETTOP` surface wetness fraction (0.0 to 1.0 scale).

3. **Simulated Submission Provenance**:
   - File: `predictions.csv` (1,460 rows).
   - Stations: `12119000` (Cedar River, WA) and `14211720` (Willamette River, OR).
   - **Status**: Strictly a simulated out-of-sample evaluation pipeline test. **NOT the official competition submission.**
   - Target discharge was completely removed prior to feature engineering and inference.

---

## 3. KNOWN LIMITATIONS & SCIENTIFIC OBSERVATIONS

1. **Basin Scale Imbalance (Fold 5 Variance)**:
   - Stations `01570500` (Susquehanna River, PA; drainage area 24,100 sq mi) and `08116650` (Brazos River, TX; drainage area 45,339 sq mi) produce baseflows and flood peaks an order of magnitude larger than headwater tributaries, driving Fold 5 RMSE to 16,950 cfs.
2. **Extreme Flood Peak Underestimation**:
   - Standard tree regression averages leaf values, leading to a 30–45% underestimation on the top 1% crest discharge events.
3. **Temporal Autocorrelation**:
   - The past-only configuration confirms river basins act as low-pass filters: antecedent soil saturation and 14-day rolling precipitation contribute ~98% of the predictive power compared to same-day weather.

