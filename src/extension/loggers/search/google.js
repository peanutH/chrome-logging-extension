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
        this.injected_tabs = [];
        
        // Bind `this` so that the functions can be passed as listeners without losing `this`
        this.on_tab_updated = this.on_tab_updated.bind(this);
        this.on_tab_focus = this.on_tab_focus.bind(this);
    }

    async log_google_ranking(tab_id, save_immediately) {
        function log_ranking(session_id, save_immediately) {
            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class GoogleSearchEvent extends BaseEvent {
                constructor(session_id, query, filename_html, filename_ranking) {
                    super(session_id);
                    this.event = "search";
                    this.search_engine = "google";
                    this.query = query;
                    this.filename_html = filename_html;
                    this.filename_ranking = filename_ranking;
                }
            }

            class AIOverviewEntry {
                constructor(text) {
                    this.rank = 0;
                    this.type = "ai_overview";
                    this.text = text;
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

            class VideoResultEntry {
                constructor(header, link, description) {
                    this.rank = 0;
                    this.type = "video_result";
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

            async function submit_ranking(ranking, name) {
                try {
                    await chrome.runtime.sendMessage({ action: "submit-ranking", data: JSON.stringify({ session_id: session_id, name: name, ranking: ranking }) });
                } catch (e) {
                    console.error(`Failed to submit ranking ${ranking}`);
                }
            }

            function parse_as_result_entry(element) {
                const content = element.querySelectorAll('[data-snhf], [data-sncf]');
                if (content.length == 0) { return null; }

                // Extract result texts and link
                let result = new ResultEntry(
                    content[0].querySelector("a h3").innerText,
                    content[0].querySelector("a").getAttribute("href"),
                    content[1].innerText
                )

                return result;
            }

            function parse_as_result_entry_with_video(element) {
                const img_el = element.querySelector('img');
                const entries = element.querySelectorAll('[data-snhf], [data-sncf]');
                if (img_el == null || entries.length != 0) { return null; }

                // Extract result text and link
                const header_el = element.querySelector('h3');
                const content = element.children[0].children[0].children[1];
                const link_el = content.querySelector('a');
                const description_el = content.querySelector(':scope > div');
                let result = new VideoResultEntry(
                    header_el.innerText,
                    link_el.getAttribute("href"),
                    description_el.innerText
                )

                return result;
            }

            function parse_search_content(element) {
                let content = null;

                try { content = parse_as_result_entry(element); } catch(e) { content = null }
                if (content != null) { return content; }

                try { content = parse_as_result_entry_with_video(element); } catch(e) { content = null; }
                if (content != null) { return content; }

                return null;
            }

            // Detects an AI Overview at the start of the page
            function get_ai_overview() {
                const ai_overview_container = [...document.querySelectorAll("div [data-hveid]")]
                    .find(div =>
                        div.textContent.includes("AI Overview") &&
                        !div.closest("#rso")
                    );
                
                try {
                    const text_container = ai_overview_container
                                            .querySelector("section")
                                            .querySelector("div[decode-data-ved]")
                                            .children[0]
                                            .querySelector(':scope > div:first-of-type');
                    let overview = new AIOverviewEntry(text_container.innerText);
                    return overview;
                } catch (e) {
                    return null;
                }
                
            }

            var past_ranking = null;
            var curr_query = null;
            function save_google_ranking(timestamp, should_submit_event) {
                // Avoid duplicates due to page loading signals from other content (within same page)
                if (window.__searchlog_last_export_timestamp && ((Date.now() - window.__searchlog_last_export_timestamp) < 1000) ) { return; }
                window.__searchlog_last_export_timestamp = Date.now();

                try {
                    let query_text = document.querySelector('textarea[name="q"]').getAttribute('value');
                    if (!query_text) {
                        query_text = document.querySelector('textarea[name="q"]').textContent;
                    }
                    if (!curr_query) { curr_query = query_text; }
                    if (query_text !== curr_query) { return; } // User is typing new query (triggers observer). Don't save ranking
                    const filename_html = `${timestamp}_${query_text}.html`
                    const filename_ranking = `${timestamp}_${query_text}.json`
                    const event = new GoogleSearchEvent(session_id, query_text, filename_html, filename_ranking);
                    const html = document.documentElement.outerHTML;
                    let ranking = [];
        
                    // Look for AI Overview
                    let ai_overview = get_ai_overview();
                    if (ai_overview != null) {
                        ai_overview.rank = 0
                        ranking.push(ai_overview);
                    }

                    // Parse search results
                    const search_results_elements = document.querySelectorAll("#rso [data-hveid]");
                    let curr_rank = 1;
                    for (const element of search_results_elements) {
                        if (element.children.length === 0) { continue; }
        
                        let content = parse_search_content(element);
        
                        if (content != null) {
                            content.rank = curr_rank;
                            curr_rank++;
                            ranking.push(content);
                        }
                    }

                    // Avoids submitting if the same as previous one
                    if ((past_ranking !== null) && (JSON.stringify(ranking) === JSON.stringify(past_ranking))) {
                        return 
                    }
                    past_ranking = ranking;
                    
                    if (should_submit_event) {
                        submit_event(event);
                    }
                    submit_html(html, filename_html);
                    submit_ranking({
                        "source": "google",
                        "ranking": ranking
                    }, filename_ranking);
                }
                catch (e) {
                    console.error(e);
                }
            }

            (() => {
                // Run only on Google (except AI mode)
                if ((!/^https?:\/\/(?:[^/]+\.)?google\.[a-z.]+\/search(?:\?|$)/i.test(window.location.href)) ||
                    (document.querySelector("[data-xid=aim-mars-turn-root]"))) {
                    return;
                }

                const export_timestamp = Date.now();
                let last_export_timestamp = Date.now();
                
                if (save_immediately) {
                    save_google_ranking(export_timestamp, true);
                }
                // Listen to page changes and update previous event/ranking (if needed)
                if (!window.__searchlog_observer_google) {
                    window.__searchlog_observer_google = new MutationObserver((mutations) => {
                        if (Date.now() - last_export_timestamp >= 1000) {
                            save_google_ranking(export_timestamp, false);
                            last_export_timestamp = Date.now();
                        }
                    });
                    window.__searchlog_observer_google.observe(document.querySelector("#rcnt"), { childList: true, subtree: true });
                }
            })();
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: log_ranking,
            args: [this.session_id, save_immediately]
        });
        this.injected_tabs.push(tab_id);
    }

    async stop_observer(tab_id) {
        function stop_injected_listeners() {
            try {
                window.__searchlog_observer_google.disconnect();
                console.log("Closed Google observer");
            } catch (e) {
                console.error(`Cannot stop Google observer ${e}`);
            }
            window.__searchlog_last_export_timestamp = undefined;
            window.__searchlog_observer_google = undefined;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: stop_injected_listeners,
            args: []
        });
    }

    on_tab_updated(tab_id, changed_info, tab) {
        if (changed_info["status"] === "complete") {
            this.log_google_ranking(tab_id, true);
        }
    }

    on_tab_focus(info) {
        this.log_google_ranking(info.tabIds[0], false);
    }

    async start_listeners() {
        chrome.tabs.onUpdated.addListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.addListener(this.on_tab_focus);

        const curr_tab = (await chrome.tabs.query({currentWindow: true, active : true}))[0];
        this.log_google_ranking(curr_tab.id, true);
    } 

    stop_listeners() {
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.removeListener(this.on_tab_focus);
        for (const id of this.injected_tabs) {
            try {
                this.stop_observer(id);
            } catch (e) {
                console.warn(`Cannot stop Google observer of tab ${id}`);
            }
        }
        this.injected_tabs = [];
    }
}