"""
Flask Application Factory for Data Center Health AI
Serves the 3D Web Dashboard, REST API endpoints, and real-time WebSocket feeds.
"""

from pathlib import Path
from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_sock import Sock

from config.config import PORT, HOST, BASE_DIR
from config.logging_config import logger
from src.api.routes import api_bp
from src.api.ws_stream import register_websocket
from src.ml.model_registry import inference_engine

def create_app() -> Flask:
    """Creates and configures the Flask application."""
    app = Flask(
        __name__,
        static_folder=str(BASE_DIR / "webapp"),
        static_url_path=""
    )
    CORS(app)
    sock = Sock(app)

    # Register REST API Blueprints
    app.register_blueprint(api_bp)

    # Register WebSocket Endpoint
    register_websocket(sock)

    # Serve 3D GLB Models
    @app.route("/models/<path:filename>")
    def serve_model(filename):
        models_dir = BASE_DIR / "datacente_model"
        return send_from_directory(models_dir, filename)

    # Serve Web Dashboard Root
    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")

    logger.info("Flask Application created successfully.")
    return app

app = create_app()

if __name__ == "__main__":
    logger.info(f"Starting Data Center Health AI server on http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=False)
