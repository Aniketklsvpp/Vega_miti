import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def calculate_metrics(y_true, y_pred, station_ids=None):
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)
    
    if len(y_true) == 0:
        return {
            "overall_rmse": float("nan"),
            "extreme_rmse": float("nan"),
            "mae": float("nan"),
            "r2": float("nan"),
            "composite_score": float("nan"),
            "n_total": 0,
            "n_extreme": 0
        }

    valid_mask = np.isfinite(y_true) & np.isfinite(y_pred)
    if not np.all(valid_mask):
        y_true = y_true[valid_mask]
        y_pred = y_pred[valid_mask]
        if station_ids is not None:
            station_ids = np.asarray(station_ids)[valid_mask]

    n_total = len(y_true)
    if n_total == 0:
        return {
            "overall_rmse": float("nan"),
            "extreme_rmse": float("nan"),
            "mae": float("nan"),
            "r2": float("nan"),
            "composite_score": float("nan"),
            "n_total": 0,
            "n_extreme": 0
        }

    overall_rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    mae = float(mean_absolute_error(y_true, y_pred))
    r2 = float(r2_score(y_true, y_pred)) if n_total > 1 and np.var(y_true) > 1e-9 else 0.0

    extreme_mask = np.zeros(n_total, dtype=bool)
    if station_ids is not None:
        station_arr = np.asarray(station_ids)
        unique_stations = np.unique(station_arr)
        for st in unique_stations:
            st_idx = np.where(station_arr == st)[0]
            st_y = y_true[st_idx]
            if len(st_y) > 0:
                threshold = np.percentile(st_y, 90.0)
                st_ext = st_idx[st_y >= threshold]
                extreme_mask[st_ext] = True
    else:
        threshold = np.percentile(y_true, 90.0)
        extreme_mask = y_true >= threshold

    n_extreme = int(np.sum(extreme_mask))
    if n_extreme > 0:
        extreme_rmse = float(np.sqrt(mean_squared_error(y_true[extreme_mask], y_pred[extreme_mask])))
    else:
        extreme_rmse = overall_rmse

    composite_score = 0.40 * overall_rmse + 0.30 * extreme_rmse + 0.20 * mae - 0.10 * max(0.0, r2 * 100.0)

    return {
        "overall_rmse": round(overall_rmse, 4),
        "extreme_rmse": round(extreme_rmse, 4),
        "mae": round(mae, 4),
        "r2": round(r2, 4),
        "composite_score": round(composite_score, 4),
        "n_total": n_total,
        "n_extreme": n_extreme
    }

def identify_extreme_events(y_true, station_ids=None):
    y_true = np.asarray(y_true, dtype=float)
    n = len(y_true)
    mask = np.zeros(n, dtype=int)
    if n == 0:
        return mask
    if station_ids is not None:
        station_arr = np.asarray(station_ids)
        for st in np.unique(station_arr):
            idx = np.where(station_arr == st)[0]
            if len(idx) > 0:
                th = np.percentile(y_true[idx], 90.0)
                mask[idx[y_true[idx] >= th]] = 1
    else:
        th = np.percentile(y_true, 90.0)
        mask[y_true >= th] = 1
    return mask

