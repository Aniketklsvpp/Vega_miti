# DELTA-SWARM — DATA ACQUISITION & INVENTORY GUIDE

**Project:** DELTA-SWARM  
**Version:** 1.0.0  
**Target Directories:**  
- `data/raw/caravan/`  
- `data/raw/usgs/`  
- `data/raw/india/`  
- `data/raw/weather/`  
- `data/reports/`

---

## 1. CARAVAN DATASET ACQUISITION

### Official Release Metadata
- **Title:** Caravan - A global community dataset for large-sample hydrology
- **Authors:** Frederik Kratzert, Martin Gauch, Grey Nearing, Daniel Klotz, Sepp Hochreiter
- **Persistent DOI:** [10.5281/zenodo.6578598](https://doi.org/10.5281/zenodo.6578598)
- **Zenodo Record URL:** `https://zenodo.org/records/6578598`
- **Companion Journal Paper:** *Nature Scientific Data* 10, 61 (2023) [DOI: 10.1038/s41597-023-01975-w](https://doi.org/10.1038/s41597-023-01975-w)
- **Official Code Repository:** [https://github.com/kratzert/Caravan](https://github.com/kratzert/Caravan)
- **License:** Creative Commons Attribution 4.0 International (CC-BY 4.0)

### Archive Contents on Zenodo
The official Zenodo release stores standardized daily time series and HydroATLAS attributes partitioned by regional dataset:
1. `attributes.zip` (HydroATLAS physiographic, soil, geological, and climatic attributes for all 7,100+ basins).
2. Regional time series archives:
   - `camels.zip` (CAMELS-US, 531 basins — direct overlap with USGS streamflow network)
   - `camelsaus.zip` (CAMELS-AUS, 222 basins)
   - `camelsbr.zip` (CAMELS-BR, 897 basins)
   - `camelscl.zip` (CAMELS-CL, 516 basins)
   - `camelsgb.zip` (CAMELS-GB, 518 basins)
   - `hysets.zip` (HYSETS North America, 2,512 basins)
   - `lamah.zip` (LamaH-CE Central Europe, 859 basins)

### Step-by-Step Download Instructions

#### Option A: Targeted Download for US/CAMELS Benchmarking (Recommended for Phase 1/2)
To acquire the CAMELS-US slice and static attributes without downloading the full global archive (~15 GB):

```bash
# 1. Ensure target directory exists
mkdir -p data/raw/caravan

# 2. Download attributes archive directly from Zenodo
curl -L -o data/raw/caravan/attributes.zip "https://zenodo.org/records/6578598/files/attributes.zip?download=1"

# 3. Download CAMELS (US) daily timeseries
curl -L -o data/raw/caravan/camels.zip "https://zenodo.org/records/6578598/files/camels.zip?download=1"

# 4. Extract archives into partitioned directories
unzip data/raw/caravan/attributes.zip -d data/raw/caravan/attributes
unzip data/raw/caravan/camels.zip -d data/raw/caravan/timeseries/camels
```

#### Option B: Automated Retrieval via `zenodo_get`
```bash
pip install zenodo-get
zenodo_get 6578598 -o data/raw/caravan/
```

---

## 2. EXISTING USGS DATASET REPRODUCIBILITY

The existing 22-station US benchmark is reproduced via the repository data acquisition module:

```bash
# Activate virtual environment
.venv\Scripts\activate

# Run acquisition and data processing
python -m src.data_acquisition
```

**What this executes:**
1. Fetches metadata and basin drainage area from the USGS NWIS Site Web Service.
2. Queries USGS Daily Values Web Service (parameter `00060`) for 730 contiguous days (`2022-01-01` to `2023-12-31`).
3. Fetches matched daily meteorology (`precipitation_mm`, `temp_max_c`, `temp_min_c`, `soil_moisture`) from Open-Meteo with automatic fallback to NASA POWER.
4. Generates standardized training dataset at `data/processed/train.csv` (16,060 rows, 22 stations) and `data/processed/station_metadata.csv`.

---

## 3. INDIA-WRIS & CWC PILOT ACQUISITION

For expanding DELTA-SWARM to Indian river basins:

1. **Central Water Commission (CWC) Telemetry:**
   - Access: [https://ffs.india-water.gov.in/](https://ffs.india-water.gov.in/)
   - Monitor real-time stage, danger level, and historical hydrographs for pilot basins (e.g., Godavari, Krishna, Mahanadi).
2. **India-WRIS Geospatial Downloads:**
   - Access: [https://indiawris.gov.in/wris/](https://indiawris.gov.in/wris/)
   - Export daily discharge reports (cumecs) and catchment characteristics.
   - Save downloaded files to `data/raw/india/<basin_name>/`.
3. **Meteorological Matching for Indian Basins via NASA POWER API:**
   - When IMD binary grids are unavailable, query NASA POWER using station coordinates:
   ```bash
   curl "https://power.larc.nasa.gov/api/temporal/daily/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN,GWETTOP&community=AG&longitude=80.1234&latitude=16.5432&start=20220101&end=20231231&format=JSON" -o data/raw/weather/india_station_weather.json
   ```

---

## 4. DATASET INVENTORY AUDIT

To inspect any downloaded or processed dataset and generate an automated validation audit:

```bash
# Run the dataset inventory utility
python src/data_inventory.py
```

**Output:**  
- Audit report generated at `data/reports/dataset_inventory.json`
- Reports station count, date span, temporal resolution, unit detection, missingness, duplicate checks, and negative discharge counts.
