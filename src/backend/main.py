import os
import json
import time
import uuid
from flask import Flask, request, jsonify
from dotenv import load_dotenv

load_dotenv()


# Initalize flask app
app = Flask(__name__)

# Setup data directory
DATA_DIR = os.getenv("DATA_DIR")
os.makedirs(DATA_DIR, exist_ok=True)


class LoggingManager:
    def __init__(self, path):
        self.path = path
        self.file = open(path, "w")
        self.num_logs = 0
        self.file.write("[\n")

    def add(self, json_data):
        if self.num_logs == 0:
            self.file.write(f"{json.dumps(json_data)}")
        else:
            self.file.write(f",\n{json.dumps(json_data)}")
        self.file.flush()
        self.num_logs += 1

    def close(self):
        self.file.write("\n]")
        self.file.close()

    def prettify(self):
        with open(self.path, "r") as f:
            data = json.load(f)
        with open(self.path, "w") as f:
            json.dump(data, f, indent=3)



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
    ranking_dir = os.path.join(out_dir, "rankings")
    out_log_file = os.path.join(out_dir, "session.json")

    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(html_dir, exist_ok=True)
    os.makedirs(ranking_dir, exist_ok=True)

    active_sessions[session_id] = {
        "out_dir": out_dir,
        "events_log": LoggingManager(out_log_file),
        "raw_logs": {},
        "ranking_dir": ranking_dir,
        "html_dir": html_dir
    }

    return jsonify({
        "session_id": session_id,
    }), 200


# Terminate session
@app.route("/end", methods=["POST"])
def end_session():
    session_id = request.get_json()["session_id"]

    if session_id in active_sessions:
        # Close loggers and prettify results
        for logger in [active_sessions[session_id]["events_log"]] + list(active_sessions[session_id]["raw_logs"].values()):
            logger.close()
            if "raw-mouse.json" in logger.path: continue
            logger.prettify()

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
        active_sessions[session_id]["events_log"].add(log)
        return jsonify({}), 200
    else:
        return jsonify({}), 400


# Record a raw event
@app.route('/log-raw', methods=['POST'])
def log_raw_state():
    log = request.get_json()
    session_id = log["session_id"]

    if session_id in active_sessions:
        out_file = os.path.join(active_sessions[session_id]["out_dir"], f"raw-{log['event']}.json")
        if out_file not in active_sessions[session_id]["raw_logs"]:
            active_sessions[session_id]["raw_logs"][out_file] = LoggingManager(out_file)

        active_sessions[session_id]["raw_logs"][out_file].add(log)
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


# Save an html page
@app.route('/ranking', methods=['POST'])
def save_ranking():
    data = request.get_json()
    session_id = data["session_id"]

    if session_id in active_sessions:
        with open(os.path.join(active_sessions[session_id]["ranking_dir"], data["name"]), "w") as f:
            json.dump(data["ranking"], f, indent=3)
        return jsonify({}), 200
    else:
        return jsonify({}), 400


if __name__ == '__main__':
    app.run(port=5000)