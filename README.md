# NII Browser Logging Extension

A browser extension for Chrome/Edge that logs user interactions with the browser to support research on search behaviors. The extension captures browser state changes, page visits, and page content, sending all data to a Flask backend for storage and analysis.

## What It Logs

1. **Browser State Changes** - Window/tab creation, switching, closing, focus changes
2. **Page Visits** - URLs visited and visit history
3. **Page Content Scraping** - Links on pages, page text/HTML, AI overview detection

## Setup Instructions

### Step 1: Set Up the Backend (Python Flask Server)

The backend receives data from the extension and saves it to JSONL files.

1. **Install Python dependencies:**
   ```bash
   cd backend
   pip install flask flask-cors
   ```

2. **Run the Flask server:**
   ```bash
   python main.py
   ```
   
  The server will start on `http://127.0.0.1:5000`

3. **What the backend does:**
   - Creates a `data` folder automatically
   - Creates a new session folder each time you click **Begin Logging**
   - Stores logs per session with these files:
     - `state.jsonl` - Browser state changes (windows/tabs)
     - `visit.jsonl` - Page visit data
     - `scrape.jsonl` - Scraped link data
     - `page.jsonl` - Full page body text/HTML
     - `actions.jsonl` - Inferred user actions with confidence and evidence links
     - `session_meta.json` - Session metadata (start/end times and counts)

### Step 2: Install the Browser Extension

1. **Open Chrome/Edge and go to:**
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. **Enable "Developer mode"** (toggle in the top-right corner)

3. **Click "Load unpacked"**

4. **Select the `extension` folder** from this repository

5. **The extension should now appear** in your browser toolbar

### Step 3: Start Logging

1. **Click the extension icon** in your browser toolbar

2. **Click "Begin Logging"** button
   - The extension will start capturing your browser activity
   - A new `session_id` is created and shown in the popup
   - The popup shows live status indicators:
     - Logging state (`Logging` / `Stopped`)
     - Backend state (`Connected` / `Disconnected`)
     - Current session ID (with copy button)
  - All data is sent to the Flask backend at `http://127.0.0.1:5000`

3. **Browse normally** - the extension will log:
   - Every tab/window you open, close, or switch to
   - Every page you visit
   - Links and content on each page you load

4. **Click "End Logging"** when done
   - Stops capturing browser activity
   - Finalizes the current session metadata

### Expected Runtime Flow

1. Start backend with `python main.py`
2. Reload extension from `chrome://extensions` after code changes
3. Open popup and confirm backend shows `Connected`
4. Click **Begin Logging** and confirm session ID appears
5. Do browsing tasks
6. Click **End Logging**
7. Open `backend/data/<session_id>/` to inspect output files

### Step 4: Access the Logged Data

All data is saved under `backend/data/<session_id>/`:

- `state.jsonl` - Complete browser state snapshots with all windows/tabs
- `visit.jsonl` - URL visit records with visit counts
- `scrape.jsonl` - Scraped links from each page
- `page.jsonl` - Full page content (text and HTML)
- `actions.jsonl` - Inferred high-level actions from raw logs
- `session_meta.json` - Session summary (status, start/end time, event counts)

Each line in these files is a separate JSON object you can parse and analyze.

### File Schema Details

- `session_meta.json` (single JSON object):
  - `session_id`, `start_time`, `end_time`, `status`, `counts`
- `state.jsonl` (one JSON object per line):
  - `event_id`, `event_type`, `browser_time`, `server_time`, `event_tab`, `event_window`
  - `focused_tab`, `focused_window`, `windows`, `tabs`, `session_id`
- `visit.jsonl` (one JSON object per line):
  - `event_id`, `tab_id`, `url`, `visit_count`, `last_visit`, `server_time`, `session_id`
- `scrape.jsonl` (one JSON object per line):
  - `event_id`, `tabId`, `url`, `timeStamp`, `results`, `aiOverview`, `server_time`, `session_id`
- `page.jsonl` (one JSON object per line):
  - `event_id`, `pageBodyText`, `pageBodyHTML`, `server_time`, `session_id`
- `actions.jsonl` (one JSON object per line):
  - `action_id`, `session_id`, `action_type`, `action_time`, `tab_id`, `window_id`
  - `source_url`, `target_url`, `confidence`, `evidence_event_ids`, `metadata`
  - Current action types:
    - `TAB_OPENED`
    - `TAB_CLOSED`
    - `TAB_SWITCHED`
    - `SEARCH_SUBMITTED`
    - `RESULT_CLICKED`
    - `BACK_FORWARD_NAVIGATION`
    - `RETURN_TO_SERP`
  - Notes on inference:
    - `SEARCH_SUBMITTED` is emitted when search engine query URLs are detected (`google`, `bing`, `duckduckgo`, `yahoo`).
    - `RESULT_CLICKED` is emitted when a tab moves from a SERP URL to a different domain.
    - `BACK_FORWARD_NAVIGATION` is emitted from URL-sequence reversal patterns in a tab history.
    - `RETURN_TO_SERP` is emitted when a tab returns from non-SERP content back to a remembered SERP.

### Backend Endpoints

- `GET /health` - backend health check used by popup connection status
- `POST /session/start` - starts a new logging session
- `POST /session/end` - ends the active session
- `GET /session/status` - returns active session information
- `POST /logState` - receives state snapshots
- `POST /logVisit` - receives visit/navigation events
- `POST /logScrape` - receives scrape and page-body payloads

## Important Notes

- **The Flask backend must be running** before you start logging, otherwise the extension won't be able to send data
- The extension requires extensive permissions (`tabs`, `storage`, `downloads`, `webNavigation`, `history`, `scripting`) to capture all browser activity
- Logs are stored locally on your machine in the `backend/data/` directory

## Troubleshooting

1. **Extension not working?** Check the browser console for errors (F12 → Console tab)
2. **Data not being saved?** Ensure the Flask server is running on port 5000
3. **CORS errors?** The Flask server has CORS enabled, but ensure it's running locally
4. **Backend shows disconnected on Mac?** Verify backend responds on `http://127.0.0.1:5000/health` (some environments resolve `localhost` differently)

