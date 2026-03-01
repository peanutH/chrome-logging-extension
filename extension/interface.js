const statusEl = document.getElementById("loggingStatus");
const backendHealthEl = document.getElementById("backendHealth");
const sessionEl = document.getElementById("sessionId");
const feedbackEl = document.getElementById("feedback");
const startBtn = document.getElementById("startLogging");
const endBtn = document.getElementById("endLogging");
const copySessionBtn = document.getElementById("copySession");

function setStatus(sessionId = null) {
    statusEl.textContent = sessionId ? "Logging" : "Stopped";
    statusEl.className = `pill ${sessionId ? "status-on" : "status-off"}`;
    sessionEl.textContent = sessionId || "None";
    startBtn.disabled = sessionId;
    endBtn.disabled = !sessionId;
    copySessionBtn.disabled = !sessionId;
}

function setFeedback(message, isError = false) {
    feedbackEl.textContent = message;
    feedbackEl.style.color = isError ? "#a61d24" : "#444";
}

function setBackendHealth(isOnline, message = "") {
    backendHealthEl.textContent = isOnline ? "Connected" : "Disconnected";
    backendHealthEl.className = `pill ${isOnline ? "health-ok" : "health-down"}`;
    if (message) {
        setFeedback(message, !isOnline);
    }
}

async function sendMessage(action, payload = {}) {
    const response = await chrome.runtime.sendMessage({ action, ...payload });
    return response;
}

async function refreshBackendHealth() {
    const response = await sendMessage("check_backend_health");
    if (!response.ok) {
        setBackendHealth(false, "Backend is not reachable.");
        return false;
    }

    setBackendHealth(true);
    return true;
}

async function refreshStatus() {
    const response = await sendMessage("get_logging_status");
    if (!response.ok) {
        setFeedback("Failed to fetch current status.", true);
        return;
    }

    setStatus(response.sessionId);
    setFeedback("Status loaded.");
}

startBtn.addEventListener("click", async () => {
    const backendOk = await refreshBackendHealth();
    if (!backendOk) { return; }

    const response = await sendMessage("start_logs");
    if (!response.ok) {
        setFeedback("Failed to start logging.", true);
        return;
    }

    setStatus(response.sessionId);
    setFeedback("Logging started.");
});

endBtn.addEventListener("click", async () => {
    const backendOk = await refreshBackendHealth();
    if (!backendOk) {
        return;
    }

    const response = await sendMessage("end_logs");
    if (!response.ok) {
        setFeedback("Failed to stop logging.", true);
        return;
    }

    setStatus(response.sessionId);
    setFeedback("Logging stopped.");
});

copySessionBtn.addEventListener("click", async () => {
    const sessionId = sessionEl.textContent;
    if (!sessionId || sessionId === "None") {
        return;
    }

    try {
        await navigator.clipboard.writeText(sessionId);
        setFeedback("Session ID copied.");
    } catch (error) {
        setFeedback("Could not copy session ID.", true);
    }
});

async function initializePopup() {
    await refreshBackendHealth();
    await refreshStatus();
}

initializePopup();

