/**
 * 
 * Module handling mouse events:
 * - Mouse movement
 * - Mouse click
 * - Text selection (keyboard included)
 * - Scrolling
 * 
 */

export class MouseEventsHandler {
    constructor(session_id) {
        /**
         * @param {string} session_id
         */
        this.session_id = session_id;
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_focused = this.on_tab_focused.bind(this)
        this.on_tab_updated = this.on_tab_updated.bind(this)
    }

    async start_listeners_on_tab(tab_id) {
        function inject_listeners(session_id) {
            if (document.__myClickListenerAdded_mouse) { return; }
            document.__myClickListenerAdded_mouse = true;

            const MouseAction = Object.freeze({
                MOVE: "mouse_move",
                CLICK: "mouse_click",
                DOUBLE_CLICK: "mouse_double_click",
            });

            class Coord {
                constructor(x, y) { this.x = x; this.y = y; }
            }

            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class MouseMoveEvent extends BaseEvent {
                constructor(session_id, action, mouse_from, mouse_to) {
                    super(session_id);
                    this.action = action;
                    this.mouse_from = mouse_from;
                    this.mouse_to = mouse_to;
                }
            }

            class MouseEvent extends BaseEvent {
                constructor(session_id, action, mouse) {
                    super(session_id);
                    this.action = action;
                    this.mouse = mouse;
                }
            }
            
            class SelectEvent extends BaseEvent {
                constructor(session_id, text) {
                    super(session_id);
                    this.action = "text_select";
                    this.text = text;
                }
            }

            class ScrollEvent extends BaseEvent {
                constructor(session_id, scroll_start, scroll_end) {
                    super(session_id);
                    this.action = "scroll";
                    this.scroll_start = scroll_start;
                    this.scroll_end = scroll_end;
                }
            }

            async function submit_event(event) {
                console.log(event);
                await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
            }

            // *** Mouse single click tracking ***
            async function mouse_click(e) {
                const event = new MouseEvent(session_id, MouseAction.CLICK, new Coord(e.screenX, e.screenY));
                submit_event(event);
            }

            // *** Mouse double click tracking ***
            async function mouse_double_click(e) {
                const event = new MouseEvent(session_id, MouseAction.DOUBLE_CLICK, new Coord(e.screenX, e.screenY));
                submit_event(event);
            }

            // *** Mouse movement tracking ***
            var curr_mouse_move_start = null;
            var curr_mouse_move_end = null;
            var curr_mouse_move_promise = null;
            async function mouse_move(e) {
                if (curr_mouse_move_start === null) {
                    // First time tracking cursor
                    curr_mouse_move_start = new Coord(e.screenX, e.screenY)
                } else {
                    // Keep tracking cursor
                    curr_mouse_move_end = new Coord(e.screenX, e.screenY)
                }
                // Create a promise with timeout. If the cursor does not move after a while, record movement.
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_mouse_move_promise !== curr_promise) { return resolve(); } // Cursor moved, ignore this promise
                    const event = new MouseMoveEvent(session_id, MouseAction.MOVE, curr_mouse_move_start, curr_mouse_move_end);
                    curr_mouse_move_start = null;
                    curr_mouse_move_end = null;
                    await submit_event(event);
                    resolve();
                }, 250));
                curr_mouse_move_promise = curr_promise;
                await curr_promise;
            }

            // *** Hovered element tracking ***
            async function mouse_hover(e) {
                // TODO Add hovered element as info in event
            }

            // *** Text selection (with mouse or keyboard) tracking ***
            var curr_selected_promise = null;
            async function text_select(e) {
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_selected_promise !== curr_promise) { return resolve(); } // Selection changed, ignore this promise
                    const selection = window.getSelection().toString();
                    const event = new SelectEvent(session_id, selection);
                    await submit_event(event);
                    resolve();
                }, 500));
                curr_selected_promise = curr_promise;
                await curr_promise;
            }

            // *** Mouse wheel tracking ***
            var curr_scroll_start = null;
            var curr_scroll_end = null;
            var curr_scroll_promise = null;
            async function page_scroll(e) {
                if (curr_scroll_start === null) {
                    // First time tracking cursor
                    curr_scroll_start = new Coord(window.scrollX, window.scrollY)
                } else {
                    // Keep tracking cursor
                    curr_scroll_end = new Coord(window.scrollX, window.scrollY)
                }
                // Create a promise with timeout. If the cursor does not move after a while, record movement.
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_scroll_promise !== curr_promise) { return resolve(); } // Wheel moved, ignore this promise
                    const event = new ScrollEvent(session_id, curr_scroll_start, curr_scroll_end);
                    curr_scroll_start = null;
                    curr_scroll_end = null;
                    await submit_event(event);
                    resolve();
                }, 250));
                curr_scroll_promise = curr_promise;
                await curr_promise;

            }

            document.addEventListener("click", mouse_click);
            document.addEventListener("dblclick", mouse_double_click);
            document.addEventListener("mousemove", mouse_move);
            document.addEventListener("mouseover", mouse_hover);
            document.addEventListener("selectionchange", text_select);
            document.addEventListener("scroll", page_scroll);
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: inject_listeners,
            args: [this.session_id]
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
        chrome.tabs.onHighlighted.removeListener(this.on_tab_focused)
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated)
    }
}