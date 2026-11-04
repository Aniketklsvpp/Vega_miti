# Vega_miti — FLOODCAST

Machine learning and prediction engine for river discharge prediction (`discharge_cfs`) evaluated under unseen-station generalization and extreme-event accuracy.

## Architecture

- `src/metrics.py`: Competition metrics (Overall RMSE 40%, Extreme-event RMSE 30%, MAE 20%, R2 10%).
- `src/validation.py`: Station-grouped out-of-fold cross-validation (`LeaveOneGroupOut` / `GroupKFold`).
- `src/train.py`: Model builders and target transformations (`raw` vs `log1p`).
- `src/model_selection.py`: Model benchmarking and extreme-event error analytics.
- `src/predict.py`: Test inference engine generating nonnegative discharge predictions.
- `src/feature_adapter.py`: Interface contract adapter for Member 1 feature engineering pipeline.
- `src/synthetic_fixture.py`: Reproducible synthetic hydrological data generator.
- `run_pipeline.py`: End-to-end execution script.
- `tests/test_ml_engine.py`: Test suite.

## Execution

```powershell
python run_pipeline.py
```

## Testing

```powershell
python -m unittest discover tests
```
