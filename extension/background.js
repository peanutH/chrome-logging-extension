import { StateEventsHandler } from './loggers/state.js';
import { MouseEventsHandler } from './loggers/mouse.js';
import { KeyboardEventsHandler } from './loggers/keyboard.js';
import { GoogleEventsHandler } from './loggers/google.js';
import { BACKEND_BASE_URL } from "./constants.js"


var curr_session = null;
var state_handler = null;
var mouse_handler = null;
var keyboard_handler = null;
var google_handler = null;


async function init_monitoring(session_id) {
    const curr_windows = await chrome.windows.getAll()
    const curr_tabs = await chrome.tabs.query({})

    state_handler = new StateEventsHandler(session_id, curr_windows, curr_tabs);
    state_handler.start_listeners();

    mouse_handler = new MouseEventsHandler(session_id);
    mouse_handler.start_listeners();

    keyboard_handler = new KeyboardEventsHandler(session_id);
    keyboard_handler.start_listeners();

    google_handler = new GoogleEventsHandler(session_id);
    google_handler.start_listeners();
}

function stop_monitoring() {
    state_handler.stop_listeners();
    mouse_handler.stop_listeners();
    keyboard_handler.stop_listeners();
}


async function backendRequest(path, options={}) {
    const response = await fetch(`${BACKEND_BASE_URL}${path}`, options);
    let payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.message || `Backend request failed (${response.status})`);
    }

    return payload;
}


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) {
        sendResponse({ ok: false, message: "Invalid request." });
        return;
    }
    
    switch (message.action) {
        case "submit-log":
            backendRequest("/log", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.log
            })
            return true

        case "submit-html":
            backendRequest("/html", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.data
            })
            return true

        case "submit-ranking":
            backendRequest("/ranking", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.data
            })
            return true


        case "check_backend_health":
            try {
                backendRequest("/peanut", { method: "GET" }).then(response => {
                    sendResponse({ ok: true });
                });
            } catch (error) {
                console.log("error")
                sendResponse({ ok: false });
            }
            return true


        case "start_logs":
            if (curr_session) {
                sendResponse({ ok: true, sessionId: curr_session, });
                return true;
            }
            
            try {
                backendRequest("/start", { method: "POST" }).then(async response => {
                    curr_session = response.session_id;
                    await init_monitoring(curr_session);
                    sendResponse({ ok: true, sessionId: curr_session });
                });
            } catch (error) {
                curr_session = null;
                sendResponse({ ok: false, sessionId: null });
            }
            return true


        case "get_logging_status":
            sendResponse({ ok: true, sessionId: curr_session });
            return true


        case "end_logs":
            if (!curr_session) {
                sendResponse({ ok: true, sessionId: null, });
                return true;
            }

            try {
                backendRequest("/end", { 
                    method: "POST", 
                    headers: { "Content-Type": "application/json", },
                    body: JSON.stringify({ session_id: curr_session })
                }).then(response => {
                    curr_session = null;
                    stop_monitoring()
                    sendResponse({ ok: true, sessionId: null });
                });
            } catch (error) {
                sendResponse({ ok: false, sessionId: curr_session });
            }
            return true
    }
});