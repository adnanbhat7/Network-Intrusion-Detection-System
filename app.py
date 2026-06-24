"""
shieldnet/app.py
Run:  python app.py
Visit: http://localhost:5000
"""
from flask import Flask, render_template
from api.predict import predict_bp

app = Flask(__name__, template_folder='templates', static_folder='static')
app.register_blueprint(predict_bp)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, port=5000)
