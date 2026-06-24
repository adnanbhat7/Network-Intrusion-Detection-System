"""
shieldnet/api/predict.py
POST /api/predict
Body:  { "features": { "FLOW DURATION": 12345, "FWD PKT/S": 45.2, ... } }
Returns: { "label": "DoS", "confidence": 0.92, "probabilities": [0.02, 0.92, 0.04, 0.02] }
"""
from flask import Blueprint, request, jsonify
from model.loader import get_model, get_scaler, get_encoder, get_features
import numpy as np

predict_bp = Blueprint('predict', __name__)

@predict_bp.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json(force=True)
    raw_features = data.get('features', {})

    try:
        model    = get_model()
        scaler   = get_scaler()
        encoder  = get_encoder()
        features = get_features()
    except RuntimeError as e:
        return jsonify({'error': str(e), 'model_loaded': False}), 503

    try:
        X = np.array([[raw_features.get(f, 0.0) for f in features]], dtype=np.float32)
    except Exception as e:
        return jsonify({'error': f'Feature vector error: {e}'}), 400

    X_scaled = scaler.transform(X)
    X_cnn    = X_scaled.reshape(1, X_scaled.shape[1], 1)
    proba    = model.predict(X_cnn, verbose=0)[0]
    pred_idx = int(np.argmax(proba))

    return jsonify({
        'label':         encoder.inverse_transform([pred_idx])[0],
        'confidence':    round(float(proba[pred_idx]), 4),
        'probabilities': [round(float(p), 4) for p in proba],
        'model_loaded':  True,
    })
