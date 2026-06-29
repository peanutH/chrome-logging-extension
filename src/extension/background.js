import { StateEventsHandler } from './loggers/state.js';
import { MouseEventsHandler } from './loggers/mouse.js';
import { KeyboardEventsHandler } from './loggers/keyboard.js';
import { GoogleEventsHandler } from './loggers/search/google.js';
import { GoogleAIModeEventsHandler } from './loggers/search/google_aimode.js';
import { BingEventsHandler } from './loggers/search/bing.js';
import { BACKEND_BASE_URL } from "./constants.js";
import { dry_run } from "./dry_run.js";


var curr_session = null;
var state_handler = null;
var mouse_handler = null;
var keyboard_handler = null;
var google_handler = null;
var google_aimode_handler = null;
var bing_handler = null;


async function init_monitoring(session_id) {
    const curr_windows = await chrome.windows.getAll()
    const curr_tabs = await chrome.tabs.query({})

    try {
        state_handler = new StateEventsHandler(session_id, curr_windows, curr_tabs);
        await state_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize state monitoring ${e}`);
    }

    try {
        mouse_handler = new MouseEventsHandler(session_id);
        await mouse_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize mouse monitoring ${e}`);
    }

    try {
        keyboard_handler = new KeyboardEventsHandler(session_id);
        await keyboard_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize keyboard monitoring ${e}`);
    }

    try {
        google_handler = new GoogleEventsHandler(session_id);
        await google_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize Google monitoring ${e}`);
    }

    try {
        google_aimode_handler = new GoogleAIModeEventsHandler(session_id);
        await google_aimode_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize Google (AI Mode) monitoring ${e}`);
    }

    try {
        bing_handler = new BingEventsHandler(session_id);
        await bing_handler.start_listeners();
    } catch (e) {
        console.error(`Failed to initialize Bing monitoring ${e}`);
    }
}

function stop_monitoring() {
    try { state_handler.stop_listeners(); }         catch (e) { console.error(e); }
    try { mouse_handler.stop_listeners(); }         catch (e) { console.error(e); }
    try { keyboard_handler.stop_listeners(); }      catch (e) { console.error(e); }
    try { google_handler.stop_listeners(); }        catch (e) { console.error(e); }
    try { google_aimode_handler.stop_listeners(); } catch (e) { console.error(e); }
    try { bing_handler.stop_listeners(); }          catch (e) { console.error(e); }
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
            return;

        case "submit-raw":
            backendRequest("/log-raw", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.log
            })
            return;

        case "submit-html":
            backendRequest("/html", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.data
            })
            return;

        case "submit-llm":
            backendRequest("/llm", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.data
            })
            return;

        case "submit-ranking":
            backendRequest("/ranking", { 
                method: "POST", 
                headers: { "Content-Type": "application/json", },
                body: message.data
            })
            return;


        case "check_backend_health":
            try {
                backendRequest("/peanut", { method: "GET" }).then(response => {
                    sendResponse({ ok: true });
                });
                return true;
            } catch (error) {
                console.log("error")
                sendResponse({ ok: false });
            }


        case "start_logs":
            if (curr_session) {
                sendResponse({ ok: true, sessionId: curr_session, });
                return;
            }
            
            try {
                backendRequest("/start", { method: "POST" }).then(async response => {
                    curr_session = response.session_id;
                    await init_monitoring(curr_session);
                    sendResponse({ ok: true, sessionId: curr_session });
                });
                return true;
            } catch (error) {
                curr_session = null;
                sendResponse({ ok: false, sessionId: null });
            }


        case "get_logging_status":
            sendResponse({ ok: true, sessionId: curr_session });
            return;


        case "end_logs":
            if (!curr_session) {
                sendResponse({ ok: true, sessionId: null, });
                return;
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
                return true;
            } catch (error) {
                sendResponse({ ok: false, sessionId: curr_session });
                return;
            }


        case "dry_run":
            (async () => {
                try {
                    let response = await backendRequest("/dry-run-start", { method: "POST" });
                    await init_monitoring(response.session_id);
                    await dry_run();
                    await stop_monitoring();
                    response = await backendRequest("/dry-run-end", {
                        method: "POST", 
                        headers: { "Content-Type": "application/json", },
                        body: JSON.stringify({ session_id: response.session_id })
                    });

                    chrome.notifications.create({
                        type: "basic",
                        iconUrl: "https://peanuth.github.io/images/totoro-blue.png",
                        title: "Dry run outcome",
                        message: response.outcome ? "Passed" : "Failed"
                    });
                } catch (e) {
                    console.error(e);
                }
            })();
            return;
    }
});