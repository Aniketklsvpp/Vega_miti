import os
import joblib
import numpy as np
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor, ExtraTreesRegressor
from sklearn.base import BaseEstimator, RegressorMixin

class TargetTransformedModel(BaseEstimator, RegressorMixin):
    def __init__(self, base_estimator, transform_target=False):
        self.base_estimator = base_estimator
        self.transform_target = transform_target
        self.fitted_estimator_ = None

    def fit(self, X, y):
        X_mat = np.asarray(X)
        y_mat = np.asarray(y, dtype=float)
        if self.transform_target:
            y_train_fit = np.log1p(np.clip(y_mat, a_min=0.0, a_max=None))
        else:
            y_train_fit = y_mat
        self.fitted_estimator_ = self.base_estimator.fit(X_mat, y_train_fit)
        return self

    def predict(self, X):
        X_mat = np.asarray(X)
        raw_pred = self.fitted_estimator_.predict(X_mat)
        if self.transform_target:
            pred = np.expm1(raw_pred)
        else:
            pred = raw_pred
        return np.clip(pred, a_min=0.0, a_max=None)

def create_model(model_name="hist_gb", transform_target=False, random_state=42):
    name = model_name.lower()
    if name == "dummy":
        base = DummyRegressor(strategy="mean")
    elif name == "random_forest":
        base = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=random_state, n_jobs=-1)
    elif name == "extra_trees":
        base = ExtraTreesRegressor(n_estimators=100, max_depth=12, random_state=random_state, n_jobs=-1)
    elif name == "hist_gb":
        base = HistGradientBoostingRegressor(max_iter=150, max_depth=6, random_state=random_state)
    else:
        base = HistGradientBoostingRegressor(max_iter=150, max_depth=6, random_state=random_state)

    return TargetTransformedModel(base_estimator=base, transform_target=transform_target)

def train_full(model, X, y):
    return model.fit(X, y)

def save_model(model, filepath):
    os.makedirs(os.path.dirname(os.path.abspath(filepath)), exist_ok=True)
    joblib.dump(model, filepath)

def load_model(filepath):
    return joblib.load(filepath)

