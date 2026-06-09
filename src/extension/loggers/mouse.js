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
        this.injected_tabs = [];
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_focused = this.on_tab_focused.bind(this)
        this.on_tab_updated = this.on_tab_updated.bind(this)
    }

    async start_listeners_on_tab(tab_id) {
        function inject_listeners(session_id) {
            if (document.__myClickListenerAdded_mouse) { return; }
            document.__myClickListenerAdded_mouse = true;
            document.__areListenersActive_mouse = true;

            const MouseAction = Object.freeze({
                MOVE: "mouse_move",
                CLICK: "mouse_click",
                DOUBLE_CLICK: "mouse_double_click",
                SCROLL: "mouse_scroll",
                SELECT: "text_select"
            });

            class Coord {
                constructor(x, y) { this.x = x; this.y = y; }
                equals(c2) { return (this.x === c2.x) & (this.y === c2.y); }
            }

            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class MouseMoveEvent extends BaseEvent {
                constructor(session_id, screen_width, screen_height, mouse_from, mouse_to, hovered_text) {
                    super(session_id);
                    this.event = "mouse"
                    this.action = MouseAction.MOVE;
                    this.screen_width = screen_width;
                    this.screen_height = screen_height;
                    this.mouse_from = mouse_from;
                    this.mouse_to = mouse_to;
                    this.hovered_text = hovered_text
                }
            }

            class MouseEvent extends BaseEvent {
                constructor(session_id, screen_width, screen_height, action, mouse, hovered_text) {
                    super(session_id);
                    this.event = "mouse"
                    this.action = action;
                    this.screen_width = screen_width;
                    this.screen_height = screen_height;
                    this.mouse = mouse;
                    this.hovered_text = hovered_text
                }
            }
            
            class SelectEvent extends BaseEvent {
                constructor(session_id, text) {
                    super(session_id);
                    this.event = "mouse"
                    this.action = MouseAction.SELECT;
                    this.text = text;
                }
            }

            class ScrollEvent extends BaseEvent {
                constructor(session_id, screen_width, screen_height, scroll_start, scroll_end) {
                    super(session_id);
                    this.event = "mouse"
                    this.action = MouseAction.SCROLL;
                    this.screen_width = screen_width
                    this.screen_height = screen_height
                    this.scroll_start = scroll_start;
                    this.scroll_end = scroll_end;
                }
            }

            async function submit_event(event) {
                await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
            }

            async function submit_raw_event(event) {
                await chrome.runtime.sendMessage({ action: "submit-raw", log: JSON.stringify(event) });
            }

            // *** Hovered element tracking ***
            var curr_hovered_text = "";
            async function mouse_hover(e) {
                if (!document.__areListenersActive_mouse) { return; }
                curr_hovered_text = e.target.innerText;
            }

            // *** Mouse single click tracking ***
            async function mouse_click(e) {
                if (!document.__areListenersActive_mouse) { return; }
                const event = new MouseEvent(session_id, document.documentElement.scrollWidth, document.documentElement.scrollHeight, MouseAction.CLICK, new Coord(e.pageX, e.pageY), curr_hovered_text);
                submit_event(event);
            }

            // *** Mouse double click tracking ***
            async function mouse_double_click(e) {
                if (!document.__areListenersActive_mouse) { return; }
                const event = new MouseEvent(session_id, document.documentElement.scrollWidth, document.documentElement.scrollHeight, MouseAction.DOUBLE_CLICK, new Coord(e.pageX, e.pageY), curr_hovered_text);
                submit_event(event);
            }

            // *** Mouse movement tracking ***
            class MouseMovementHandler {
                constructor(session_id, delay_ms, submit_raw) {
                    this.session_id = session_id
                    this.delay_ms = delay_ms;
                    this.submit_raw = submit_raw;
                    this.curr_mouse_move_start = null;
                    this.curr_mouse_move_end = null;
                    this.curr_mouse_move_promise = null;
                }

                async on_event(e, hovered_text) {
                    if (this.curr_mouse_move_start === null) {
                        // First time tracking cursor
                        this.curr_mouse_move_start = new Coord(e.pageX, e.pageY)
                        this.curr_mouse_move_end = new Coord(e.pageX, e.pageY)
                    } else {
                        // Keep tracking cursor
                        this.curr_mouse_move_end = new Coord(e.pageX, e.pageY)
                    }
                   
                    const curr_promise = new Promise(resolve => setTimeout(async () => {
                        if (this.curr_mouse_move_promise !== curr_promise) { return resolve(); } // Cursor moved, ignore this promise
                        if (!this.curr_mouse_move_start.equals(this.curr_mouse_move_end)) {
                            // Submit event only if position changed
                            const event = new MouseMoveEvent(this.session_id, document.documentElement.scrollWidth, document.documentElement.scrollHeight, this.curr_mouse_move_start, this.curr_mouse_move_end, hovered_text);
                            this.curr_mouse_move_start = this.curr_mouse_move_end;
                            this.curr_mouse_move_end = null;
                            if (this.submit_raw) {
                                await submit_raw_event(event);
                            } else {
                                await submit_event(event);
                            }
                        }
                        resolve();
                    }, this.delay_ms));
                    this.curr_mouse_move_promise = curr_promise;
                    await curr_promise;
                }
            }
            var mouse_movement_handler = new MouseMovementHandler(session_id, 250, false);
            var raw_mouse_movement_handler = new MouseMovementHandler(session_id, 10, true);
            async function mouse_move(e) {
                if (!document.__areListenersActive_mouse) { return; }
                
                await mouse_movement_handler.on_event(e, curr_hovered_text);
                await raw_mouse_movement_handler.on_event(e, "");
            }

            // *** Text selection (with mouse or keyboard) tracking ***
            var curr_selected_promise = null;
            async function text_select(e) {
                if (!document.__areListenersActive_mouse) { return; }
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_selected_promise !== curr_promise) { return resolve(); } // Selection changed, ignore this promise
                    const selection = window.getSelection().toString();
                    if (selection.length > 0) {
                        const event = new SelectEvent(session_id, selection);
                        await submit_event(event);
                    }
                    resolve();
                }, 250));
                curr_selected_promise = curr_promise;
                await curr_promise;
            }

            // *** Mouse wheel tracking ***
            var curr_scroll_start = new Coord(window.scrollX, window.scrollY);
            var curr_scroll_end = null;
            var curr_scroll_promise = null;
            async function page_scroll(e) {
                if (!document.__areListenersActive_mouse) { return; }
                // Update scroll location
                curr_scroll_end = new Coord(window.scrollX, window.scrollY);
                
                // Create a promise with timeout. If the cursor does not move after a while, record movement.
                const curr_promise = new Promise(resolve => setTimeout(async () => {
                    if (curr_scroll_promise !== curr_promise) { return resolve(); } // Wheel moved, ignore this promise
                    const event = new ScrollEvent(session_id, document.documentElement.scrollWidth, document.documentElement.scrollHeight, curr_scroll_start, curr_scroll_end);
                    curr_scroll_start = new Coord(window.scrollX, window.scrollY);
                    curr_scroll_end = null;
                    await submit_event(event);
                    resolve();
                }, 100));
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
        this.injected_tabs.push(tab_id);
    }

    async stop_listeners_on_tab(tab_id) {
        function stop_injected_listeners() {
            document.__areListenersActive_mouse = false;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: stop_injected_listeners,
            args: []
        });
    }

    on_tab_focused(info) {
        this.start_listeners_on_tab(info.tabIds[0]);
    }

    on_tab_updated(tab_id, info) {
        this.start_listeners_on_tab(tab_id);
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

        for (const id of this.injected_tabs) {
            this.stop_listeners_on_tab(id);
        }
        this.injected_tabs = [];
    }
}