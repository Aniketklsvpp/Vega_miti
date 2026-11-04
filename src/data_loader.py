from pathlib import Path
import pandas as pd

def load_csv(file_path, parse_dates=None, station_col="station_id"):
    path = Path(file_path)
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    
    dtype_spec = {station_col: str} if station_col else None
    df = pd.read_csv(path, dtype=dtype_spec)
    
    if parse_dates:
        for col in parse_dates:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors="coerce")
    
    if station_col and station_col in df.columns:
        df[station_col] = df[station_col].astype(str)
        
    return df

def load_dataset(data_dir, split="train"):
    dir_path = Path(data_dir)
    file_map = {
        "train": "train.csv",
        "test": "test.csv",
        "station_metadata": "station_metadata.csv",
        "sample_submission": "sample_submission.csv"
    }
    target_file = file_map.get(split, f"{split}.csv")
    full_path = dir_path / target_file
    parse_cols = ["date"] if split in ["train", "test", "sample_submission"] else None
    return load_csv(full_path, parse_dates=parse_cols)

def load_all_data(data_dir):
    dir_path = Path(data_dir)
    results = {}
    for key, filename in [
        ("train", "train.csv"),
        ("test", "test.csv"),
        ("metadata", "station_metadata.csv"),
        ("sample_submission", "sample_submission.csv")
    ]:
        full_path = dir_path / filename
        if full_path.is_file():
            parse_cols = ["date"] if key in ["train", "test", "sample_submission"] else None
            results[key] = load_csv(full_path, parse_dates=parse_cols)
        else:
            results[key] = None
    return results

