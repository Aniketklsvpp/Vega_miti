import argparse
import os
import pandas as pd
from src.feature_engineering import build_features
from src.predict import RiverDischargePredictor

def main():
    parser = argparse.ArgumentParser(description="Vega_miti River Discharge Inference Engine")
    parser.add_argument("--test-csv", default=None, help="Path to input test CSV")
    parser.add_argument("--train-csv", default="data/processed/train.csv", help="Path to reference train CSV for feature engineering context")
    parser.add_argument("--config", default="A", choices=["A", "B", "primary", "past_only"], help="Model configuration (A: HistGradientBoosting+log1p, B: ExtraTrees+raw)")
    parser.add_argument("--output", default="predictions.csv", help="Path for output predictions CSV")
    args = parser.parse_args()

    train_df = pd.read_csv(args.train_csv) if os.path.exists(args.train_csv) else None

    if args.test_csv is not None and os.path.exists(args.test_csv):
        test_df = pd.read_csv(args.test_csv)
    else:
        test_stations = ["12119000", "14211720", 12119000, 14211720]
        test_mask = train_df["station_id"].isin(test_stations)
        test_df = train_df[test_mask].copy().drop(columns=["discharge_cfs"], errors="ignore")
        train_df = train_df[~test_mask].copy()

    _, _, X_test, _, test_idents, feature_names, _ = build_features(train_df, test_df)
    X_test_df = pd.DataFrame(X_test, columns=feature_names)

    predictor = RiverDischargePredictor()
    preds_df = predictor.predict_to_csv(X_test_df, test_idents, output_path=args.output, config=args.config)

    print("INFERENCE RUN COMPLETED")
    print(f"Configuration: {args.config}")
    print(f"Input Rows: {len(test_df)}")
    print(f"Output File: {args.output}")
    print(f"Output Columns: {list(preds_df.columns)}")
    print(f"Min Discharge: {preds_df['discharge_cfs'].min()} cfs")
    print(f"Max Discharge: {preds_df['discharge_cfs'].max()} cfs")

if __name__ == "__main__":
    main()
