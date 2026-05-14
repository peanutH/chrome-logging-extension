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


# Start session
@app.route("/start", methods=["POST"])
def start_session():
    session_id = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"

    out_dir = os.path.join(DATA_DIR, f"{session_id}")
    html_dir = os.path.join(out_dir, "pages")
    out_log_file = os.path.join(out_dir, "session.json")

    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(html_dir, exist_ok=True)

    active_sessions[session_id] = {
        "out_dir": out_dir,
        "out_file_path": out_log_file,
        "out_file": open(out_log_file, "w"),
        "html_dir": html_dir,
        "num_logs": 0
    }

    active_sessions[session_id]["out_file"].write("[\n")

    return jsonify({
        "session_id": session_id,
    }), 200


# Terminate session
@app.route("/end", methods=["POST"])
def end_session():
    session_id = request.get_json()["session_id"]

    if session_id in active_sessions:
        active_sessions[session_id]["out_file"].write("\n]")
        active_sessions[session_id]["out_file"].close()

        # Make final json prettier
        with open(active_sessions[session_id]["out_file_path"], "r") as f:
            data = json.load(f)
        with open(active_sessions[session_id]["out_file_path"], "w") as f:
            json.dump(data, f, indent=3)

        del active_sessions[session_id]
        return jsonify({}), 200
    else:
        return jsonify({}), 404


# Record an event
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


# Save an html page
@app.route('/html', methods=['POST'])
def save_page():
    data = request.get_json()
    session_id = data["session_id"]

    if session_id in active_sessions:
        with open(os.path.join(active_sessions[session_id]["html_dir"], data["name"]), "w") as f:
            f.write(data["html"])
        return jsonify({}), 200
    else:
        return jsonify({}), 400



if __name__ == '__main__':
    app.run(port=5000)