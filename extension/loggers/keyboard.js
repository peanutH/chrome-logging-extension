/**
 * 
 * Module handling keyboard events:
 * - Typing
 * - Copy-paste
 * 
 */


export class KeyboardEventsHandler {
    constructor(session_id) {
        /**
         * @param {string} session_id
         */
        this.session_id = session_id;
        this.injected_tabs = [];
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_focused = this.on_tab_focused.bind(this)
        this.on_tab_updated = this.on_tab_updated.bind(this)
    }

    async start_listeners_on_tab(tab_id) {
        function inject_listeners(session_id) {
            if (document.__myClickListenerAdded_keyboard) { return; }
            document.__myClickListenerAdded_keyboard = true;
            document.__areListenersActive_keyboard = true;

            const KeyboardAction = Object.freeze({
                WRITE: "write",
            });

            const CopyPasteAction = Object.freeze({
                COPY: "copy",
                PASTE: "paste",
                CUT: "cut",
            });

            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class KeyboardEvent extends BaseEvent {
                constructor(session_id, action, typed) {
                    super(session_id);
                    this.event = "keyboard"
                    this.action = action;
                    this.typed = typed;
                }
            }

            class CopyPasteEvent extends BaseEvent {
                constructor(session_id, action, content) {
                    super(session_id);
                    this.event = "clipboard"
                    this.action = action;
                    this.content = content;
                }
            }
            
            async function submit_event(event) {
                await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
            }


            // *** Keyboard press tracking ***
            var curr_keyboard_string = "";
            var curr_keyboard_promise = null
            async function keyboard_press(e) {
                if (!document.__areListenersActive_keyboard) { return; }
                // Decode typed key
                let typed = ""
                switch (e.code) {
                    case "ShiftLeft":    typed = "[SHIFT]"; break;
                    case "ShiftRight":   typed = "[SHIFT]"; break;
                    // case "ControlLeft":  typed = "[CONTROL]"; break;
                    // case "ControlRight": typed = "[CONTROL]"; break;
                    case "Tab":          typed = "[TAB]"; break;
                    case "AltLeft":      typed = "[ALT]"; break;
                    case "AltRight":     typed = "[ALT]"; break;
                    case "MetaLeft":     typed = "[META]"; break;
                    case "MetaRight":    typed = "[META]"; break;
                    case "Backspace":    typed = "[BACKSPACE]"; break;
                    case "Enter":        typed = "[ENTER]"; break;
                    case "Escape":       typed = "[ESCAPE]"; break;
                    case "Insert":       typed = "[INSERT]"; break;
                    case "Delete":       typed = "[DELETE]"; break;
                    case "Home":         typed = "[HOME]"; break;
                    case "End":          typed = "[END]"; break;
                    case "PageUp":       typed = "[PAGE_UP]"; break;
                    case "PageDown":     typed = "[PAGE_DOWN]"; break;
                    case "ArrowLeft":    typed = "[ARROW_LEFT]"; break;
                    case "ArrowRight":   typed = "[ARROW_RIGHT]"; break;
                    case "ArrowUp":      typed = "[ARROW_UP]"; break;
                    case "ArrowDown":    typed = "[ARROW_DOWN]"; break;
                    case "NumLock":      typed = "[NUMLOCK]"; break;
                    case "F1":           typed = "[F1]"; break;
                    case "F2":           typed = "[F2]"; break;
                    case "F3":           typed = "[F3]"; break;
                    case "F4":           typed = "[F4]"; break;
                    case "F5":           typed = "[F5]"; break;
                    case "F6":           typed = "[F6]"; break;
                    case "F7":           typed = "[F7]"; break;
                    case "F8":           typed = "[F8]"; break;
                    case "F9":           typed = "[F9]"; break;
                    case "F10":          typed = "[F10]"; break;
                    case "F11":          typed = "[F11]"; break;
                    case "F12":          typed = "[F12]"; break;
                    default:             typed = e.key; break;
                }
                
                // Detect if the user is writing in a password field
                const curr_active = document.activeElement;
                if (
                    curr_active != null
                    && (curr_active instanceof HTMLInputElement || curr_active instanceof HTMLTextAreaElement || curr_active.isContentEditable) 
                    && (curr_active.type === "password" || curr_active.getAttribute("type") === "password")
                ) {
                    typed = "[HIDDEN]";
                }

                // Do not record keys pressed with ctrl (i.e., commands)
                if (e.ctrlKey && (e.code !== "ControlLeft" || e.code !== "ControlRight")) { return; }

                curr_keyboard_string = curr_keyboard_string + typed
                
                // Create a promise with timeout. If the no keys are pressed after a while, record written string.
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_keyboard_promise !== curr_promise) { return resolve(); } // Keyboard pressed, ignore this promise
                    const event = new KeyboardEvent(session_id, KeyboardAction.WRITE, curr_keyboard_string);
                    curr_keyboard_string = ""
                    await submit_event(event);
                    resolve();
                }, 250));
                curr_keyboard_promise = curr_promise;
                await curr_promise;
            }

            // *** Copy tracking ***
            async function copy_event(e) {
                if (!document.__areListenersActive_keyboard) { return; }
                const content = document.getSelection().toString();
                const event = new CopyPasteEvent(session_id, CopyPasteAction.COPY, content);
                submit_event(event);
            }

            // *** Past tracking ***
            async function paste_event(e) {
                if (!document.__areListenersActive_keyboard) { return; }
                const content = (e.clipboardData || window.clipboardData).getData("text");
                const event = new CopyPasteEvent(session_id, CopyPasteAction.PASTE, content);
                submit_event(event);
            }

            // *** Cut tracking ***
            async function cut_event(e) {
                if (!document.__areListenersActive_keyboard) { return; }
                const content = document.getSelection().toString();
                const event = new CopyPasteEvent(session_id, CopyPasteAction.CUT, content);
                submit_event(event);
            }

            document.addEventListener("keydown", keyboard_press);
            document.addEventListener("copy", copy_event);
            document.addEventListener("cut", cut_event);
            document.addEventListener("paste", paste_event);
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: inject_listeners,
            args: [this.session_id]
        });
        this.injected_tabs.push(tab_id);
    }

    async stop_listeners_on_tab(tab_id) {
        function stop_injected_listeners() {
            document.__areListenersActive_keyboard = false;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: stop_injected_listeners,
            args: []
        });
    }

    on_tab_focused(info) {
        this.start_listeners_on_tab(info.tabIds[0])
    }

    on_tab_updated(tab_id, info) {
        this.start_listeners_on_tab(tab_id)
    }

    async start_listeners() {
        chrome.tabs.onHighlighted.addListener(this.on_tab_focused);
        chrome.tabs.onUpdated.addListener(this.on_tab_updated);

        const curr_tab = (await chrome.tabs.query({currentWindow: true, active : true}))[0];
        this.start_listeners_on_tab(curr_tab.id);
    } 

    stop_listeners() {
        chrome.tabs.onHighlighted.removeListener(this.on_tab_focused);
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated);

        for (const id of this.injected_tabs) {
            this.stop_listeners_on_tab(id);
        }
        this.injected_tabs = [];
    }
}