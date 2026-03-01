import os
import json
import time
import uuid
from flask import Flask, request, jsonify
from flask_cors import CORS


# Initalize flask app
app = Flask(__name__)
CORS(app)

# Setup data directory
DATA_DIR = "./data"
os.makedirs(DATA_DIR, exist_ok=True)


active_sessions = {}


@app.route("/peanut", methods=["GET"])
def healt_check():
    return jsonify({ "pudding": True }), 200


@app.route("/start", methods=["POST"])
def start_session():
    session_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    active_sessions[session_id] = {
        "out_file": open(os.path.join(DATA_DIR, f"{session_id}.json"), "w"),
        "num_logs": 0
    }
    active_sessions[session_id]["out_file"].write("[\n")

    return jsonify({
        "session_id": session_id,
    }), 200


@app.route("/end", methods=["POST"])
def end_session():
    session_id = request.get_json()["session_id"]

    if session_id in active_sessions:
        active_sessions[session_id]["out_file"].write("\n]")
        active_sessions[session_id]["out_file"].close()
        del active_sessions[session_id]
        return jsonify({}), 200
    else:
        return jsonify({}), 404


@app.route('/log', methods=['POST'])
def log_state():
    log = request.get_json()
    session_id = log["session_id"]

    if session_id in active_sessions:
        if active_sessions[session_id]["num_logs"] == 0:
            active_sessions[session_id]["out_file"].write(f"{json.dumps(log)}")
        else:
            active_sessions[session_id]["out_file"].write(f",\n{json.dumps(log)}")
        active_sessions[session_id]["num_logs"] += 1
        active_sessions[session_id]["out_file"].flush()
        return jsonify({}), 200
    else:
        return jsonify({}), 400



if __name__ == '__main__':
    app.run(port=5000)