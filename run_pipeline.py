import os
import sys
import pandas as pd
from src.synthetic_fixture import generate_synthetic_data
from src.feature_adapter import get_feature_pipeline
from src.model_selection import ModelComparisonEngine
from src.predict import generate_predictions

def run():
    train_csv = os.path.join("data", "raw", "train.csv")
    test_csv = os.path.join("data", "raw", "test.csv")

    if os.path.exists(train_csv) and os.path.exists(test_csv):
        train_df = pd.read_csv(train_csv)
        test_df = pd.read_csv(test_csv)
        is_synthetic = False
    else:
        train_df, test_df = generate_synthetic_data(seed=42)
        is_synthetic = True

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
    preds_df = generate_predictions(final_model, X_test, test_idents, output_path="predictions.csv")

    print(f"PIPELINE COMPLETE")
    print(f"Dataset Status: {'Synthetic Fixture' if is_synthetic else 'Official Competition Data'}")
    print(f"Selected Model: {comparison_output['selected_config']['name']}")
    agg = comparison_output['validation_result']['aggregate_metrics']
    print(f"Overall RMSE: {agg['overall_rmse']}")
    print(f"Extreme-Event RMSE: {agg['extreme_rmse']}")
    print(f"MAE: {agg['mae']}")
    print(f"R2: {agg['r2']}")
    print(f"Test Predictions Generated: {len(preds_df)}")

if __name__ == "__main__":
    run()

