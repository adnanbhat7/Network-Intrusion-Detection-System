"""
shieldnet/model/loader.py

Loads the trained CNN model, scaler, label encoder, and feature list once
at startup and caches them in module-level variables.

REQUIRED FILES in model/:
  cnn_model.keras        — trained Keras CNN
  scaler.pkl             — fitted RobustScaler
  label_encoder.pkl      — fitted LabelEncoder
  features.pkl           — ordered list of feature names

HOW TO GENERATE:
  Run cic_nids_cnn.ipynb through Cell 14 (Save Model & Artefacts).
  The notebook saves all four files automatically.
  Then copy them here:

    cp cic_ids_cnn_final.keras      shieldnet/model/cnn_model.keras
    cp cic_ids_cnn_scaler.pkl       shieldnet/model/scaler.pkl
    cp cic_ids_cnn_labelencoder.pkl shieldnet/model/label_encoder.pkl
    cp cic_ids_cnn_features.pkl     shieldnet/model/features.pkl
"""
import os, joblib

_model = _scaler = _encoder = _features = None
MODEL_DIR = os.path.dirname(__file__)

def _load_all():
    global _model, _scaler, _encoder, _features
    paths = {
        'cnn_model.keras':    ('model',   'keras'),
        'scaler.pkl':         ('scaler',  'pkl'),
        'label_encoder.pkl':  ('encoder', 'pkl'),
        'features.pkl':       ('features','pkl'),
    }
    missing = [f for f in paths if not os.path.exists(os.path.join(MODEL_DIR, f))]
    if missing:
        raise RuntimeError(
            f"Missing model files in model/: {missing}. "
            "Run the CNN notebook (Cell 14) and copy the output files here. "
            "See model/README.md for exact instructions."
        )
    import tensorflow as tf
    _model    = tf.keras.models.load_model(os.path.join(MODEL_DIR, 'cnn_model.keras'))
    _scaler   = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
    _encoder  = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.pkl'))
    _features = joblib.load(os.path.join(MODEL_DIR, 'features.pkl'))
    print(f"[ShieldNet] Model loaded — {len(_features)} features — classes: {list(_encoder.classes_)}")

def get_model():
    if _model is None: _load_all()
    return _model

def get_scaler():
    if _scaler is None: _load_all()
    return _scaler

def get_encoder():
    if _encoder is None: _load_all()
    return _encoder

def get_features():
    if _features is None: _load_all()
    return _features
