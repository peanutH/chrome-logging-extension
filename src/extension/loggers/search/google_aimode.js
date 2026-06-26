/**
 * 
 * Module handling ranking on Google AI mode tab
 * 
 */


export class GoogleAIModeEventsHandler {
    constructor(session_id) {
        /**
         * @param {string} session_id
         */
        this.session_id = session_id;
        this.injected_tabs = [];
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_updated = this.on_tab_updated.bind(this)
        this.on_tab_focus = this.on_tab_focus.bind(this);
    }

    async log_google_ai_mode(tab_id, save_immediately) {
        function log_conversation(session_id, save_immediately) {
            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class GoogleAIModeSearchEvent extends BaseEvent {
                constructor(session_id, prompt, filename_html, filename_chat) {
                    super(session_id);
                    this.event = "llm_search";
                    this.search_engine = "google_ai_mode";
                    this.prompt = prompt;
                    this.filename_html = filename_html;
                    this.filename_chat = filename_chat;
                }
            }

            class ResultEntry {
                constructor(header, link, description) {
                    this.rank = 0;
                    this.type = "text_result";
                    this.title = header;
                    this.link = link;
                    this.description = description;
                }
            }


            async function submit_event(event) {
                try {
                    await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
                } catch (e) {
                    console.error(`Failed to submit event ${event}`);
                }
            }

            async function submit_html(html, name) {
                try {
                    await chrome.runtime.sendMessage({ action: "submit-html", data: JSON.stringify({ session_id: session_id, name: name, html: html }) });
                } catch (e) {
                    console.error(`Failed to submit HTML ${name}`);
                }
            }

            async function submit_llm(chat, name) {
                try {
                    await chrome.runtime.sendMessage({ action: "submit-llm", data: JSON.stringify({ session_id: session_id, name: name, chat: chat }) });
                } catch (e) {
                    console.error(`Failed to submit LLM chat ${chat}`);
                }
            }


            function get_conversation() {
                let chat = [];
                
                // Extract raw conversation text
                const clone = document.querySelector("[data-xid=aim-mars-turn-root]").cloneNode(true);
                clone.querySelectorAll('script, style').forEach(el => el.remove());
                clone.querySelectorAll('[role="heading"][aria-level="2"]').forEach(el => el.prepend('\n[__SEARCHLOG-CONV-SEPARATOR]'));
                clone.querySelectorAll('[role="heading"][aria-level="2"]').forEach(el => el.append('\n[__SEARCHLOG-CONV-SEPARATOR]'));
                raw_conversation = clone.innerText.trim().split("[__SEARCHLOG-CONV-SEPARATOR]");

                for (conv of raw_conversation) {
                    let text = "";
                    let role = "";

                    if (conv.slice(0, 9) === "You said:") {
                        text = conv.slice(9).trim();
                        role = "user";
                    } else {
                        text = conv.trim();
                        role = "system";
                    }

                    if (text.length > 0) {
                        chat.push({ "role": role, "text": text })
                    }
                }

                return chat
            }

            var past_chat = null;
            function save_google_ai_mode_conversation(timestamp, should_submit_event) {
                // Avoid duplicates due to page loading signals from other content (within same page)
                if (window.__searchlog_last_export_timestamp && ((Date.now() - window.__searchlog_last_export_timestamp) < 1000) ) { return; }
                window.__searchlog_last_export_timestamp = Date.now();
                
                try {
                    const chat = get_conversation();
    
                    // Don't submit if response not yet provided
                    if (chat[chat.length-1]["role"] === "user") { return; }
                    // Avoids submitting if the same as previous one
                    if ((past_chat !== null) && (JSON.stringify(chat) === JSON.stringify(past_chat))) { return; }
                    const should_submit_event = (past_chat === null) || (chat.length != past_chat.length) // Submit new event only new messages are sent (not updated)
                    past_chat = chat;
    
                    const filename_html = `${timestamp}_${chat[0]['text']}.html`;
                    const filename_chat = `${timestamp}_${chat[0]['text']}.json`;
                    const html = document.documentElement.outerHTML;
                    const event = new GoogleAIModeSearchEvent(session_id, chat[chat.length-2]["text"], filename_html, filename_chat);
    
                    if (should_submit_event) {
                        submit_event(event);
                    }
                    submit_html(html, filename_html);
                    submit_llm({
                        "source": "google_ai_mode",
                        "chat": chat
                    }, filename_chat);
                } catch (e) {
                    console.error(e);
                }
            }

            (() => {
                // Run only on Google AI Mode
                if ((!/^https?:\/\/(?:[^/]+\.)?google\.[a-z.]+\/search(?:\?|$)/i.test(window.location.href)) ||
                    (!document.querySelector("[data-xid='aim-mars-turn-root']"))) {
                    return;
                }

                if (!window.__searchlog_export_timestamp_file) {
                    // URL is changed at each interaction (tab update triggered every time). Save timestamp globally once for file name
                    window.__searchlog_export_timestamp_file = Date.now();
                }
                let last_export_timestamp = Date.now();
                
                if (save_immediately) {
                    save_google_ai_mode_conversation(window.__searchlog_export_timestamp_file, true);
                }

                // Listen to page changes and update previous event/chat (if needed)
                if (!window.__searchlog_observer_google_aimode) {
                    window.__searchlog_observer_google_aimode = new MutationObserver((mutations) => {
                        if (Date.now() - last_export_timestamp >= 2000) {
                            save_google_ai_mode_conversation(window.__searchlog_export_timestamp_file, false);
                            last_export_timestamp = Date.now();
                        }
                    });
                    document.addEventListener('DOMContentLoaded', () => {
                        window.__searchlog_observer_google_aimode.observe(document.querySelector("[data-xid='aim-mars-turn-root']"), { childList: true, subtree: true });
                    });
                }
            })();
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: log_conversation,
            args: [this.session_id, save_immediately]
        });
        this.injected_tabs.push(tab_id);
    }

    async stop_observer(tab_id) {
        function stop_injected_listeners() {
            try {
                window.__searchlog_observer_google_aimode.disconnect();
                console.log("Closed Google AI Mode observer");
            } catch (e) {
                console.error(`Cannot stop Google AI Mode observer ${e}`);
            }
            window.__searchlog_export_timestamp_file = undefined;
            window.__searchlog_observer_google_aimode = undefined;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: stop_injected_listeners,
            args: []
        });
    }

    on_tab_updated(tab_id, changed_info, tab) {
        if (changed_info["status"] === "complete") {
            this.log_google_ai_mode(tab_id, true);
        }
    }

    on_tab_focus(info) {
        this.log_google_ai_mode(info.tabIds[0], false);
    }

    async start_listeners() {
        chrome.tabs.onUpdated.addListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.addListener(this.on_tab_focus);

        const curr_tab = (await chrome.tabs.query({currentWindow: true, active : true}))[0];
        this.log_google_ai_mode(curr_tab.id, true);
    } 

    stop_listeners() {
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.removeListener(this.on_tab_focus);
        for (const id of this.injected_tabs) {
            try {
                this.stop_observer(id);
            } catch (e) {
                console.warn(`Cannot stop Google AI Mode observer of tab ${id}`);
            }
        }
        this.injected_tabs = [];
    }
}