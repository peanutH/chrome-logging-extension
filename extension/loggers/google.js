/**
 * 
 * Module handling ranking on Google pages
 * 
 */


export class GoogleEventsHandler {
    constructor(session_id) {
        /**
         * @param {string} session_id
         */
        this.session_id = session_id;
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_updated = this.on_tab_updated.bind(this)
    }

    async log_google_ranking(tab_id) {
        function log_ranking(session_id) {
            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class GoogleSearchEvent extends BaseEvent {
                constructor(session_id, query, filename) {
                    super(session_id);
                    this.event = "search";
                    this.action = "google";
                    this.query = query;
                    this.filename = filename;
                }
            }

            async function submit_event(event) {
                await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
            }

            async function submit_html(html, name) {
                await chrome.runtime.sendMessage({ action: "submit-html", data: JSON.stringify({ session_id: session_id, name: name, html: html }) });
            }

            const query_text = document.querySelector('textarea[name="q"]').getAttribute('value');
            const filename = `${query_text}_${Date.now()}.html`
            const event = new GoogleSearchEvent(session_id, query_text, filename);
            const html = document.documentElement.outerHTML;

            submit_event(event);
            submit_html(html, filename);
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: log_ranking,
            args: [this.session_id]
        });
    }

    on_tab_updated(tab_id, changed_info, tab) {
        if (changed_info["status"] === "complete") {
            this.log_google_ranking(tab_id);
        }
    }

    async start_listeners() {
        chrome.tabs.onUpdated.addListener(this.on_tab_updated);

        const curr_tab = (await chrome.tabs.query({currentWindow: true, active : true}))[0];
        this.log_google_ranking(curr_tab.id);
    } 

    stop_listeners() {
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated)
    }
}