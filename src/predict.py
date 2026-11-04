import os
import numpy as np
import pandas as pd
from src.train import load_model

def generate_predictions(model_or_path, X_test, test_identifiers, output_path="predictions.csv"):
    if isinstance(model_or_path, str):
        model = load_model(model_or_path)
    else:
        model = model_or_path

    X_mat = np.asarray(X_test)
    raw_preds = model.predict(X_mat)
    
    clean_preds = np.clip(raw_preds, a_min=0.0, a_max=None)
    clean_preds = np.where(np.isfinite(clean_preds), clean_preds, 0.0)

    ident_df = pd.DataFrame(test_identifiers).copy()
    station_col = "station_id" if "station_id" in ident_df.columns else ident_df.columns[0]
    date_col = "date" if "date" in ident_df.columns else (ident_df.columns[1] if len(ident_df.columns) > 1 else None)

    if len(clean_preds) != len(ident_df):
        raise ValueError(f"Mismatch between prediction count ({len(clean_preds)}) and test row count ({len(ident_df)})")

    out_df = pd.DataFrame({
        "station_id": ident_df[station_col].values,
        "date": ident_df[date_col].values if date_col is not None else np.arange(len(clean_preds)),
        "discharge_cfs": np.round(clean_preds, 4)
    })

    if output_path is not None:
        os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
        out_df.to_csv(output_path, index=False)

    return out_df

