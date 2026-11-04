# DELTA-SWARM — DATASET COMPATIBILITY AND INTEGRATION REPORT

**Project:** DELTA-SWARM (Hydrological Intelligence & Autonomous Swarm Platform)  
**Document Version:** 1.0.0  
**Date:** November 2026  
**Scope:** Regional Hydrological Data Foundations (USGS, Caravan, India-WRIS / CWC, IMD, NASA POWER)

---

## 1. EXECUTIVE SUMMARY

DELTA-SWARM expands the flood forecasting foundation of Vega_miti to a multi-regional operational intelligence platform with specific focus on:
1. **United States Basins:** Benchmark USGS historical streamflow across 22 reference basins (16,060 daily observations).
2. **Caravan Global Benchmark:** Community standard of 7,100+ standardized catchments (including CAMELS-US) with unified ERA5-Land meteorology and HydroATLAS catchment attributes.
3. **Indian River Systems:** High-vulnerability monsoon basins via India-WRIS, Central Water Commission (CWC), and IMD gridded meteorology.

This report establishes the physical, mathematical, and schema compatibility across all candidate datasets to prevent data leakage, dimensional misalignment, and temporal distortion prior to multi-regional training.

---

## 2. CROSS-DATASET SPECIFICATION MATRIX

| Dimension | USGS NWIS (Current) | Caravan (Kratzert et al. 2023) | India-WRIS / CWC | IMD Gridded Weather | NASA POWER (Current Pipeline) |
|---|---|---|---|---|---|
| **Primary Variable** | Streamflow Discharge | Specific Runoff & Volumetric Discharge | River Discharge & Water Level | Accumulated Rainfall & Temps | Precipitation & Temps |
| **Native Discharge Unit** | $\text{cfs } (\text{ft}^3/\text{s})$ | $\text{mm/day}$ (area-normalized) & $\text{m}^3/\text{s}$ | $\text{cumec } (\text{m}^3/\text{s})$ / meters level | N/A | N/A |
| **Meteorological Unit** | $\text{mm/day}, ^\circ\text{C}$ (via NASA/Open-Meteo) | $\text{mm/day}, ^\circ\text{C}$ (via ERA5-Land) | Varies (point stations) | $\text{mm}, ^\circ\text{C}$ | $\text{mm/day}, ^\circ\text{C}$ |
| **Temporal Frequency** | Daily | Daily | Daily / Sub-daily (Monsoon) | Daily (08:30 to 08:30 IST) | Daily |
| **Time Zone Reference** | Local Standard Time (LST) | UTC | Indian Standard Time (IST, UTC+5:30) | Indian Standard Time (IST, UTC+5:30) | UTC |
| **Catchment Identifier** | 8–10 digit numeric string (`01570500`) | Dataset prefix + local ID (`camels_01570500`) | Basin + station code (`CWC_GODAVARI_...`) | $0.25^\circ \times 0.25^\circ$ grid cells | Lat/Lon Point coordinates |
| **Spatial Scale** | Gauge point + drainage area | Delineated polygon + HydroATLAS attributes | Gauge point + basin metadata | Gridded surface ($0.25^\circ \approx 27\text{ km}$) | Gridded surface ($0.5^\circ \approx 50\text{ km}$) |
| **Missing Conventions** | Missing rows / USGS quality flags | `-999.0` or `NaN` | Blank, `NR` (Not Reported), zero-fill | `-999.0` (flagged grid cells) | `-999.0` or `NaN` |

---

## 3. PHYSICAL AND DIMENSIONAL COMPATIBILITY

### A. Streamflow Units and Conversions
Streamflow is reported across three incompatible dimensional systems:
1. **US Imperial Volumetric Flow ($Q_{\text{cfs}}$):** Cubic feet per second.
2. **SI Metric Volumetric Flow ($Q_{\text{m3s}}$ or cumec):** Cubic meters per second.
3. **Specific Runoff Depth ($q_{\text{mm/day}}$):** Area-normalized water depth per day, allowing direct dimensional comparison with precipitation.

#### Exact Conversion Equations:
- **Imperial to Metric Volumetric:**
  $$Q_{\text{m}^3/\text{s}} = Q_{\text{cfs}} \times 0.028316846592$$
- **Metric Volumetric to Imperial:**
  $$Q_{\text{cfs}} = Q_{\text{m}^3/\text{s}} \times 35.3146667215$$
- **Metric Volumetric to Specific Runoff Depth:**
  $$q_{\text{mm/day}} = \frac{Q_{\text{m}^3/\text{s}} \times 86,400\text{ s/day}}{A_{\text{km}^2} \times 10^6\text{ m}^2/\text{km}^2} \times 1000\text{ mm/m} = \frac{Q_{\text{m}^3/\text{s}} \times 86.4}{A_{\text{km}^2}}$$
- **USGS cfs to Specific Runoff Depth:**
  $$q_{\text{mm/day}} = \frac{Q_{\text{cfs}} \times 0.028316846592 \times 86.4}{A_{\text{sqmi}} \times 2.58998811} \approx \frac{Q_{\text{cfs}} \times 0.9446}{A_{\text{sqmi}}}$$

> [!WARNING]
> Training models across mixed datasets without explicit conversion will cause catastrophic scaling errors (a factor of 35.3 between cumecs and cfs, or orders of magnitude between volumetric flow and runoff depth). The internal schema must explicitly track both volumetric rate ($Q$) and specific depth ($q$).

### B. Soil Moisture Discrepancy
- **Caravan / ERA5-Land:** Volumetric soil water content in 4 layers ($0\text{–}7\text{ cm}$, $7\text{–}28\text{ cm}$, $28\text{–}100\text{ cm}$, $100\text{–}289\text{ cm}$) expressed in $\text{m}^3/\text{m}^3$ (typically $0.10\text{–}0.50$).
- **NASA POWER:** Surface soil wetness fraction `GWETTOP` expressed as a dimensionless ratio of moisture relative to field capacity/saturation ($0.0\text{–}1.0$).
- **IMD / In-situ:** Soil moisture is rarely reported at daily scale and must be derived from gridded satellite (SMAP/ASCAT) or reanalysis.

---

## 4. TEMPORAL AND TIME ZONE COMPATIBILITY

### A. The Diurnal Phase Shift Risk
- **USGS NWIS:** Daily values represent midnight-to-midnight in Local Standard Time (EST, CST, MST, PST).
- **Caravan (ERA5-Land):** 00:00 to 23:59 UTC.
- **IMD & India-WRIS:** Observations are recorded at 08:30 IST (which corresponds to 03:00 UTC).

#### Alignment Rule:
When computing lagged precipitation features across regions, daily records must be explicitly stamped with ISO-8601 calendar dates. Same-day weather in India (08:30 IST) partially overlaps the preceding UTC day. Feature pipelines must use strictly causal lags ($t-1$ or earlier) to eliminate boundary leakage.

---

## 5. CATCHMENT IDENTIFIER NAMESPACING

To avoid collisions between numerical identifiers from different hydrometric agencies (e.g., an 8-digit USGS gauge number overlapping an Indian basin code), DELTA-SWARM establishes a strict namespacing convention:

$$\text{Format: } \langle\text{SOURCE}\rangle:\langle\text{STATION\_ID}\rangle$$

Examples:
- `USGS:01570500` (Susquehanna River at Harrisburg, PA)
- `CARAVAN:camels_01570500` (Caravan CAMELS-US partition)
- `CARAVAN:camels_cl_3434001` (Caravan CAMELS-Chile partition)
- `INDIA:CWC_GODAVARI_001` (CWC Godavari River reference station)

---

## 6. MULTI-REGIONAL INTEGRATION STRATEGY

### Phase 1 (Current):
- Maintain the current validated USGS dataset (16,060 rows, 22 stations) in `data/processed/train.csv`.
- Create empty raw staging partitions for Caravan and Indian sources (`data/raw/caravan/`, `data/raw/india/`).
- Document reproducible acquisition instructions.

### Phase 2 (Caravan Ingestion):
- Download CAMELS-US slice of Caravan to benchmark against existing USGS stations.
- Verify convergence of specific discharge ($q_{\text{mm/day}}$) with existing volumetric discharge ($Q_{\text{cfs}}$).
- Ingest HydroATLAS static watershed descriptors (topography, soil permeability, climate indices) into `data/interim/caravan/`.

### Phase 3 (India Pilot Basins):
- Identify pilot basins with open telemetry (e.g., Krishna or Godavari basin).
- Acquire IMD gridded rainfall or NASA POWER reanalysis for coordinates.
- Evaluate single-region baseline models before pooling training sets.

---

## 7. CONCLUSION

The existing Vega_miti data pipeline (`src/data_loader.py`, `src/preprocessing.py`, `src/feature_engineering.py`) is fully compatible with this expansion provided that:
1. Target variables are normalized via the conversion formulas in [`data/metadata/data_dictionary.json`](file:///c:/Users/Asus/Documents/moves%20F/hackoven/Vega_miti/data/metadata/data_dictionary.json).
2. Station identifiers use the `SOURCE:ID` namespace.
3. Feature engineering continues to compute station-isolated, past-only lags to prevent cross-catchment leakage.
