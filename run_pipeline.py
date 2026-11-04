import os
import sys
import pandas as pd
from src.synthetic_fixture import generate_synthetic_data
from src.feature_adapter import get_feature_pipeline
from src.model_selection import ModelComparisonEngine
from src.predict import generate_predictions

def run():
    processed_train = os.path.join("data", "processed", "train.csv")
    raw_train = os.path.join("data", "raw", "train.csv")
    test_csv = os.path.join("data", "processed", "test.csv") if os.path.exists(os.path.join("data", "processed", "test.csv")) else os.path.join("data", "raw", "test.csv")

    if os.path.exists(processed_train):
        train_df = pd.read_csv(processed_train)
        is_synthetic = False
    elif os.path.exists(raw_train):
        train_df = pd.read_csv(raw_train)
        is_synthetic = False
    else:
        train_df, test_df = generate_synthetic_data(seed=42)
        is_synthetic = True

    if not is_synthetic:
        if os.path.exists(test_csv):
            test_df = pd.read_csv(test_csv)
        else:
            test_stations = ["12119000", "14211720"]
            test_mask = train_df["station_id"].astype(str).isin(test_stations)
            test_df = train_df[test_mask].copy().drop(columns=["discharge_cfs"], errors="ignore")
            train_df = train_df[~test_mask].copy()

    feature_builder = get_feature_pipeline()
    X_train, y_train, X_test, train_idents, test_idents, feature_names, quality_rep = feature_builder(train_df, test_df)

    engine = ModelComparisonEngine(random_state=42)
    comparison_output = engine.run_comparison(
        X_train,
        y_train,
        train_idents,
        feature_names=feature_names,
        is_synthetic=is_synthetic
    )

    final_model = comparison_output["final_model"]
    selected_features = comparison_output["selected_features"]
    
    X_test_df = pd.DataFrame(X_test, columns=feature_names)[selected_features]
    preds_df = generate_predictions(final_model, X_test_df, test_idents, output_path="predictions.csv")

    print("PIPELINE COMPLETE")
    print(f"Dataset Status: {'Synthetic Fixture' if is_synthetic else 'Official Collected Dataset'}")
    print(f"Training Rows: {len(train_df)}, Stations: {train_df['station_id'].nunique()}")
    print(f"Selected Model: {comparison_output['selected_config']['name']}")
    agg = comparison_output['validation_result']['aggregate_metrics']
    print(f"Overall RMSE: {agg['overall_rmse']}")
    print(f"Extreme-Event RMSE: {agg['extreme_rmse']}")
    print(f"MAE: {agg['mae']}")
    print(f"R2: {agg['r2']}")
    print(f"Test Predictions Generated: {len(preds_df)}")

if __name__ == "__main__":
    run()

