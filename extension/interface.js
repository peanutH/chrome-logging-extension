const statusEl = document.getElementById("loggingStatus");
const backendHealthEl = document.getElementById("backendHealth");
const sessionEl = document.getElementById("sessionId");
const feedbackEl = document.getElementById("feedback");
const startBtn = document.getElementById("startLogging");
const endBtn = document.getElementById("endLogging");
const copySessionBtn = document.getElementById("copySession");

function setStatus(loggingEnabled, sessionId = null) {
    statusEl.textContent = loggingEnabled ? "Logging" : "Stopped";
    statusEl.className = `pill ${loggingEnabled ? "status-on" : "status-off"}`;
    sessionEl.textContent = sessionId || "None";
    startBtn.disabled = loggingEnabled;
    endBtn.disabled = !loggingEnabled;
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

function sendMessage(action, payload = {}) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action, ...payload }, (response) => {
            if (chrome.runtime.lastError) {
                resolve({
                    ok: false,
                    message: `Extension error: ${chrome.runtime.lastError.message}`
                });
                return;
            }

            resolve(response || { ok: false, message: "No response from extension." });
        });
    });
}

async function refreshBackendHealth() {
    const response = await sendMessage("check_backend_health");
    if (!response.ok) {
        setBackendHealth(false, response.message || "Backend is not reachable.");
        return false;
    }

    setBackendHealth(true);
    return true;
}

async function refreshStatus() {
    const response = await sendMessage("get_logging_status");
    if (!response.ok) {
        setFeedback(response.message || "Failed to fetch current status.", true);
        return;
    }

    setStatus(Boolean(response.loggingEnabled), response.sessionId);
    setFeedback(response.message || "Status loaded.");
}

startBtn.addEventListener("click", async () => {
    const backendOk = await refreshBackendHealth();
    if (!backendOk) {
        return;
    }

    const response = await sendMessage("start_logs");
    if (!response.ok) {
        setFeedback(response.message || "Failed to start logging.", true);
        return;
    }

    setStatus(Boolean(response.loggingEnabled), response.sessionId);
    setFeedback(response.message || "Logging started.");
});

endBtn.addEventListener("click", async () => {
    const backendOk = await refreshBackendHealth();
    if (!backendOk) {
        return;
    }

    const response = await sendMessage("end_logs");
    if (!response.ok) {
        setFeedback(response.message || "Failed to stop logging.", true);
        return;
    }

    setStatus(Boolean(response.loggingEnabled), response.sessionId);
    setFeedback(response.message || "Logging stopped.");
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

