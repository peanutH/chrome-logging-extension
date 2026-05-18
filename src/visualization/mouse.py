import argparse
import os
import json
import io
from PIL import Image
from playwright.sync_api import sync_playwright
import numpy as np
import matplotlib.pyplot as plt
from itertools import groupby



def snapshot2image(snapshot_path, width, height):
    # Converts HTML to image
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport = {"width": width, "height": height},
            device_scale_factor = 1
        )
        page.goto(f"file://{os.path.abspath(snapshot_path)}")
        png_bytes = page.screenshot(full_page=True)
        browser.close()
    return Image.open(io.BytesIO(png_bytes))


def plot(html_path, mouse_logs, out_idx, out_dir, figsize=(20, 20)):
    # Plots page and mouse actions
    groups = [ list(group) for _, group in groupby(mouse_logs, key=lambda d: (d["screen_width"], d["screen_height"])) ]

    for i, group in enumerate(groups):
        snapshot = snapshot2image(html_path, group[0]["screen_width"], group[0]["screen_height"])
        x_raw = [d["mouse_to"]["x"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_move"]
        y_raw = [d["mouse_to"]["y"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_move"]
        x_click = [d["mouse"]["x"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_click"]
        y_click = [d["mouse"]["y"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_click"]
        x_double_click = [d["mouse"]["x"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_double_click"]
        y_double_click = [d["mouse"]["y"] for d in group if d["event"] == "mouse" and d["action"] == "mouse_double_click"]

        plt.figure(figsize=figsize)
        plt.imshow(snapshot)
        plt.plot(x_raw, y_raw, color="tab:blue")
        plt.plot(x_click, y_click, "o", color="tab:red")
        plt.plot(x_double_click, y_double_click, "x", color="tab:red")
        plt.xticks([])
        plt.yticks([])
        plt.savefig(os.path.join(out_dir, f"{out_idx:03}_{i}.png"), bbox_inches="tight", pad_inches=0)



if __name__ == "__main__":
    parser = argparse.ArgumentParser(prog="Visualization of mouse actions")
    parser.add_argument("--session-dir", type=str, required=True, help="Directory containing the session data")
    parser.add_argument("--out-dir", type=str, required=False, help="Output directory. If not provided, the session directory is used")
    args = parser.parse_args()

    session_dir = args.session_dir
    out_dir = args.out_dir if args.out_dir is not None else os.path.join(args.session_dir, "mouse-plots")
    os.makedirs(out_dir, exist_ok=True)


    with open(os.path.join(session_dir, "raw-mouse.json"), "r") as f:
        mouse_raw = json.load(f)

    with open(os.path.join(session_dir, "session.json"), "r") as f:
        session_data = json.load(f)

    # Finite state automata for plotting
    curr_state = "search-tab"
    curr_tab = None
    curr_start_timestamp = None
    curr_end_timestamp = None
    curr_mouse_logs = None
    curr_out_idx = 1
    i = 0
    while i < len(session_data):
        log = session_data[i]

        match curr_state:
            case "search-tab":
                # Search next tab focus/update
                if (log["event"] == "tab") and ((log["action"] == "tab_update") or (log["action"] == "tab_focus")):
                    curr_tab = log["tab"]
                    curr_start_timestamp = log["timestamp"]
                    curr_end_timestamp = None
                    curr_mouse_logs = []
                    curr_state = "group-mouse"
                    i += 1

            case "group-mouse":
                # Gather mouse data
                if (log["event"] == "mouse") and (log["action"] == "mouse_click"):
                    curr_mouse_logs.append(log)
                    i += 1
                elif (log["event"] == "mouse") and (log["action"] == "mouse_double_click"):
                    curr_mouse_logs.append(log)
                    i += 1
                elif (log["event"] == "tab") and ((log["action"] == "tab_update") or (log["action"] == "tab_focus")):
                    curr_end_timestamp = log["timestamp"]
                    curr_state = "plot"
                else:
                    i += 1

            case "plot":
                # Plot
                if curr_tab["filename_html"] != None:
                    raw_mouse_logs = [ l for l in mouse_raw if curr_start_timestamp <= l["timestamp"] < curr_end_timestamp ]
                    all_logs = sorted(curr_mouse_logs+raw_mouse_logs, key=lambda x: x["timestamp"])
                    html_path = os.path.join(session_dir, "pages", curr_tab["filename_html"])
                    plot(html_path, all_logs, curr_out_idx, out_dir)
                    curr_out_idx += 1
                curr_state = "search-tab"

    # Plot last
    curr_end_timestamp = session_data[-1]["timestamp"] + 1
    raw_mouse_logs = [ l for l in mouse_raw if curr_start_timestamp <= l["timestamp"] < curr_end_timestamp ]
    all_logs = sorted(curr_mouse_logs+raw_mouse_logs, key=lambda x: x["timestamp"])
    html_path = os.path.join(session_dir, "pages", curr_tab["filename_html"])
    plot(html_path, all_logs, curr_out_idx, out_dir)