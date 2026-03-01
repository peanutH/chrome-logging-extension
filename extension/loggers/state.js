/**
 * 
 * Module handling window events:
 * - Windows/tab creation
 * - Windows/tab focus
 * - Windows/tab resize
 * - Windows/tab deletion
 * 
 */

import { BaseEvent } from './BaseEvent.js';
import { BACKEND_BASE_URL } from "../constants.js"


const StateEvent = Object.freeze({
    WINDOW_CREATED: "window_create",
    WINDOW_FOCUS: "window_focus",
    WINDOW_FOCUS_OUT: "window_focus_outside",
    WINDOW_RESIZED: "window_resize",
    WINDOW_CLOSED: "window_close",
    TAB_CREATED: "tab_create",
    TAB_FOCUS: "tab_focus",
    TAB_UPDATED: "tab_update",
    TAB_CLOSED: "tab_close",
});



class Window {
    constructor(id, type, width, height, is_incognito) {
        this.id = id;
        this.type = type;
        this.width = width;
        this.height = height;
        this.is_incognito = is_incognito;
    }
}

class Tab {
    constructor(id, window_id, index, group_id, url, title, status, muted) {
        this.id = id;
        this.window_id = window_id;
        this.index = index;
        this.group_id = group_id;
        this.url = url;
        this.title = title;
        this.status = status;
        this.muted = muted;
    }
}

class WindowEvent extends BaseEvent {
    constructor(session_id, action, window) {
        super(session_id)
        this.action = action;
        this.window = window;
    }
}


class TabEvent extends BaseEvent {
    constructor(session_id, action, tab) {
        super(session_id)
        this.action = action;
        this.tab = tab;
    }
}


export class StateEventsHandler {
    constructor(session_id, curr_windows, curr_tabs) {
        /**
         * @param {string} session_id
         * @param {list} curr_windows - Active windows returned from chrome.windows.getAll()
         * @param {list} curr_tabs - Active tabs returned from chrome.tabs.query({})
         */
        this.session_id = session_id;
        this.all_windows = {} // Currently active windows
        this.all_tabs = {}    // Currently active tabs  

        // Fill with currently active windows and tabs
        curr_windows.forEach(window => {
            this.all_windows[window.id] = new Window(window.id, window.type, window.width, window.height, window.incognito)
        });
        curr_tabs.forEach(tab => {
            this.all_tabs[tab.id] = new Tab(tab.id, tab.windowId, tab.index, tab.groupId, tab.url, tab.title, tab.status, tab.mutedInfo.muted)
        });
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.window_created = this.window_created.bind(this)
        this.window_focused = this.window_focused.bind(this)
        this.window_resized = this.window_resized.bind(this)
        this.window_removed = this.window_removed.bind(this)
        this.tab_created = this.tab_created.bind(this)
        this.tab_focused = this.tab_focused.bind(this)
        this.tab_updated = this.tab_updated.bind(this)
        this.tab_removed = this.tab_removed.bind(this)
    }


    async submit_event(event) {
        await fetch(`${BACKEND_BASE_URL}/log`, {
            method: "POST", 
            headers: { "Content-Type": "application/json", },
            body: JSON.stringify(event)
        });
    }

    
    async window_created(window) {
        this.all_windows[window.id] = new Window(window.id, window.type, window.width, window.height, window.incognito);
        const event = new WindowEvent(this.session_id, StateEvent.WINDOW_CREATED, this.all_windows[window.id]);
        await this.submit_event(event);
    }

    async window_focused(window_id) {
        const state_event = this.all_windows[window_id] === undefined ? StateEvent.WINDOW_FOCUS_OUT : StateEvent.WINDOW_FOCUS
        const event = new WindowEvent(this.session_id, state_event, this.all_windows[window_id]);
        await this.submit_event(event);
    }

    async window_resized(window) {
        this.all_windows[window.id] = new Window(window.id, window.type, window.width, window.height, window.incognito);
        const event = new WindowEvent(this.session_id, StateEvent.WINDOW_RESIZED, this.all_windows[window.id]);
        await this.submit_event(event);
    }

    async window_removed(window_id) {
        const event = new WindowEvent(this.session_id, StateEvent.WINDOW_CLOSED, this.all_windows[window_id]);
        await this.submit_event(event);
        delete this.all_windows[window_id];
    }

    async tab_created(tab) {
        this.all_tabs[tab.id] = new Tab(tab.id, tab.windowId, tab.index, tab.groupId, tab.url, tab.title, tab.status, tab.mutedInfo.muted);
        const event = new TabEvent(this.session_id, StateEvent.TAB_CREATED, this.all_tabs[tab.id]);
        await this.submit_event(event);
    }

    async tab_focused(info) {
        const event = new TabEvent(this.session_id, StateEvent.TAB_FOCUS, this.all_tabs[info.tabIds[0]]);
        await this.submit_event(event);
    }

    async tab_updated(tab_id, changed_info, tab) {
        this.all_tabs[tab_id] = new Tab(tab.id, tab.windowId, tab.index, tab.groupId, tab.url, tab.title, tab.status, tab.mutedInfo.muted);
        const event = new TabEvent(this.session_id, StateEvent.TAB_UPDATED, this.all_tabs[tab_id]);
        await this.submit_event(event);
    }

    async tab_removed(tab_id, remove_info) {
        const event = new TabEvent(this.session_id, StateEvent.TAB_CLOSED, this.all_tabs[tab_id]);
        await this.submit_event(event);
        delete this.all_tabs[tab_id];
    }

    start_listeners() {
        chrome.windows.onCreated.addListener(this.window_created);
        chrome.windows.onFocusChanged.addListener(this.window_focused);
        chrome.windows.onBoundsChanged.addListener(this.window_resized);
        chrome.windows.onRemoved.addListener(this.window_removed);

        chrome.tabs.onCreated.addListener(this.tab_created);
        chrome.tabs.onHighlighted.addListener(this.tab_focused);
        chrome.tabs.onUpdated.addListener(this.tab_updated);
        chrome.tabs.onRemoved.addListener(this.tab_removed);
    } 

    stop_listeners() {
        chrome.windows.onCreated.removeListener(this.window_created);
        chrome.windows.onFocusChanged.removeListener(this.window_focused);
        chrome.windows.onBoundsChanged.removeListener(this.window_resized);
        chrome.windows.onRemoved.removeListener(this.window_removed);

        chrome.tabs.onCreated.removeListener(this.tab_created);
        chrome.tabs.onHighlighted.removeListener(this.tab_focused);
        chrome.tabs.onUpdated.removeListener(this.tab_updated);
        chrome.tabs.onRemoved.removeListener(this.tab_removed);
    } 
}