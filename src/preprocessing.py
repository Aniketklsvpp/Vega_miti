import numpy as np
import pandas as pd

class PreprocessingPipeline:
    def __init__(self, target_col="discharge_cfs", id_cols=None):
        self.target_col = target_col
        self.id_cols = id_cols if id_cols is not None else ["station_id", "date"]
        self.numeric_medians = {}
        self.fitted = False

    def fit(self, df):
        cols_to_fit = [c for c in df.columns if c not in self.id_cols and c != self.target_col]
        numeric_cols = df[cols_to_fit].select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            clean_series = df[col].replace([np.inf, -np.inf], np.nan)
            median_val = clean_series.median()
            self.numeric_medians[col] = 0.0 if pd.isna(median_val) else float(median_val)
            
        self.fitted = True
        return self

    def transform(self, df):
        if not self.fitted:
            raise RuntimeError("PreprocessingPipeline must be fitted before transform.")
            
        out_df = df.copy()
        
        if "date" in out_df.columns:
            out_df["date"] = pd.to_datetime(out_df["date"], errors="coerce")
            
        if "station_id" in out_df.columns:
            out_df["station_id"] = out_df["station_id"].astype(str)
            
        cols_to_process = [c for c in out_df.columns if c not in self.id_cols and c != self.target_col]
        numeric_cols = out_df[cols_to_process].select_dtypes(include=[np.number]).columns
        
        for col in numeric_cols:
            out_df[col] = out_df[col].replace([np.inf, -np.inf], np.nan)
            fill_val = self.numeric_medians.get(col, 0.0)
            out_df[col] = out_df[col].fillna(fill_val)
            
        return out_df

    def fit_transform(self, df):
        return self.fit(df).transform(df)

def separate_target_and_identifiers(df, target_col="discharge_cfs", id_cols=None):
    if id_cols is None:
        id_cols = ["station_id", "date"]
        
    present_ids = [c for c in id_cols if c in df.columns]
    identifiers = df[present_ids].copy()
    
    y = df[target_col].copy() if target_col in df.columns else None
    
    drop_cols = present_ids + ([target_col] if target_col in df.columns else [])
    X = df.drop(columns=drop_cols, errors="ignore").copy()
    
    return X, y, identifiers

