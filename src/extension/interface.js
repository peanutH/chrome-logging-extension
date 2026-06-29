const container_status = document.getElementById("loggingStatus");
const container_health = document.getElementById("backendHealth");
const container_session = document.getElementById("sessionId");
const container_feedback = document.getElementById("feedback");
const button_start = document.getElementById("startLogging");
const button_end = document.getElementById("endLogging");
const button_dry = document.getElementById("dryRun");
const button_session_copy = document.getElementById("copySession");

function set_status(sessionId = null) {
    container_status.textContent = sessionId ? "Logging" : "Stopped";
    container_status.className = `pill ${sessionId ? "status-on" : "status-off"}`;
    container_session.textContent = sessionId || "None";
    button_start.disabled = sessionId;
    button_end.disabled = !sessionId;
    button_dry.disabled = sessionId;
    button_session_copy.disabled = !sessionId;
}

function set_feedback(message, isError = false) {
    container_feedback.textContent = message;
    container_feedback.style.color = isError ? "#a61d24" : "#444";
}

function set_health(isOnline, message = "") {
    container_health.textContent = isOnline ? "Connected" : "Disconnected";
    container_health.className = `pill ${isOnline ? "health-ok" : "health-down"}`;
    if (message) {
        set_feedback(message, !isOnline);
    }
}

async function send_message(action, payload = {}) {
    const response = await chrome.runtime.sendMessage({ action, ...payload });
    return response;
}

async function refresh_health() {
    const response = await send_message("check_backend_health");
    if (!response.ok) {
        set_health(false, "Backend is not reachable.");
        return false;
    }

    set_health(true);
    return true;
}

async function refresh_status() {
    const response = await send_message("get_logging_status");
    if (!response.ok) {
        set_feedback("Failed to fetch current status.", true);
        return;
    }

    set_status(response.sessionId);
    // set_feedback("Status loaded.");
}

button_start.addEventListener("click", async () => {
    const backendOk = await refresh_health();
    if (!backendOk) { return; }

    const response = await send_message("start_logs");
    if (!response.ok) {
        set_feedback("Failed to start logging.", true);
        return;
    }

    set_status(response.sessionId);
    set_feedback("Logging started.");
});

button_end.addEventListener("click", async () => {
    const backendOk = await refresh_health();
    if (!backendOk) {
        return;
    }

    const response = await send_message("end_logs");
    if (!response.ok) {
        set_feedback("Failed to stop logging.", true);
        return;
    }

    set_status(null);
    set_feedback("Logging stopped.");
});

button_session_copy.addEventListener("click", async () => {
    const sessionId = container_session.textContent;
    if (!sessionId || sessionId === "None") {
        return;
    }

    try {
        await navigator.clipboard.writeText(sessionId);
        set_feedback("Session ID copied.");
    } catch (error) {
        set_feedback("Could not copy session ID.", true);
    }
});

button_dry.addEventListener("click", async () => {
    const backendOk = await refresh_health();
    if (!backendOk) {
        return;
    }
    
    await send_message("dry_run");
});

async function initialize_popup() {
    await refresh_health();
    await refresh_status();
}

initialize_popup();