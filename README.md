# ShieldNet IDS

AI-powered network intrusion detection demo website.  
1D-CNN trained on CIC-IDS 2017/2018 — 4 classes: Benign, DoS, BruteForce, Botnet.

## Repo structure

```
shieldnet/
├── app.py                  # Flask entry point
├── requirements.txt
├── README.md
│
├── templates/
│   └── index.html          # Full website (hero + simulator + docs)
│
├── static/
│   ├── css/
│   │   └── main.css        # All styles
│   └── js/
│       └── main.js         # Simulator logic + Claude AI streaming
│
├── api/
│   └── predict.py          # POST /api/predict → runs CNN model
│
└── model/
    ├── loader.py           # Loads and caches model files at startup
    ├── README.md           # How to put your model files here
    ├── cnn_model.keras     # ← PUT YOUR MODEL HERE (see model/README.md)
    ├── scaler.pkl          # ← PUT YOUR SCALER HERE
    ├── label_encoder.pkl   # ← PUT YOUR ENCODER HERE
    └── features.pkl        # ← PUT YOUR FEATURE LIST HERE
```

## Quick start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Add your trained model files (see model/README.md)

# 3. Run
python app.py

# 4. Open browser
# http://localhost:5000
```

## Without model files

The site still works. The simulator runs with profile-based data
and Claude AI still generates the analysis text.
The real CNN model is used automatically once the files are in model/.

## How the simulator works

1. User selects attack type (Benign / DoS / BruteForce / Botnet)
2. Click "Inject & Detect"
3. Frontend generates synthetic flow features matching that attack profile
4. Calls POST /api/predict → Flask → model/loader.py → CNN → probabilities
5. In parallel: calls Claude API → streams AI analysis text character by character
6. Renders pipeline stages, confidence bars, and verdict

## Training notebooks

| Notebook | Purpose |
|---|---|
| `cic_nids_analysis.ipynb` | EDA — justifies every design decision |
| `cic_nids_4class_improved.ipynb` | Trains RF, XGB, LGBM, ET, GB |
| `cic_nids_cnn.ipynb` | Trains the CNN, saves model files |
