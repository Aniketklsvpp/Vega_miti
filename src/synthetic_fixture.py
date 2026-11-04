import numpy as np
import pandas as pd

def generate_synthetic_data(seed=42):
    rng = np.random.RandomState(seed)
    train_stations = ["USGS_0101", "USGS_0102", "USGS_0103", "USGS_0104", "USGS_0105"]
    test_stations = ["USGS_0106", "USGS_0107"]
    
    dates = pd.date_range("2024-01-01", "2024-08-31", freq="D")
    
    def build_station_records(stations, is_test=False):
        records = []
        for st in stations:
            catchment_area = rng.uniform(50.0, 500.0)
            elevation = rng.uniform(200.0, 1500.0)
            base_flow = catchment_area * 0.4
            
            for d in dates:
                d_idx = (d - dates[0]).days
                day_of_year = d.dayofyear
                seasonality = np.sin(2 * np.pi * day_of_year / 365.25)
                
                precip = rng.exponential(scale=3.5) if rng.rand() < 0.35 else 0.0
                is_extreme_event = rng.rand() < 0.08
                if is_extreme_event:
                    precip += rng.uniform(40.0, 120.0)
                
                temp = 15.0 + 10.0 * seasonality + rng.normal(0, 3)
                soil_moisture = np.clip(0.2 + 0.5 * (precip / 50.0) + rng.normal(0, 0.05), 0.05, 0.95)
                
                discharge = base_flow + 1.8 * precip * (catchment_area / 100.0) + 12.0 * seasonality + rng.normal(0, 2)
                if is_extreme_event:
                    discharge *= rng.uniform(2.5, 5.0)
                discharge = max(0.0, discharge)
                
                rec = {
                    "station_id": st,
                    "date": d.strftime("%Y-%m-%d"),
                    "precipitation_mm": round(precip, 2),
                    "temperature_c": round(temp, 2),
                    "soil_moisture": round(soil_moisture, 3),
                    "catchment_area_sqkm": round(catchment_area, 2),
                    "elevation_m": round(elevation, 1)
                }
                if not is_test:
                    rec["discharge_cfs"] = round(discharge, 2)
                records.append(rec)
        return pd.DataFrame(records)

    train_df = build_station_records(train_stations, is_test=False)
    test_df = build_station_records(test_stations, is_test=True)
    return train_df, test_df

