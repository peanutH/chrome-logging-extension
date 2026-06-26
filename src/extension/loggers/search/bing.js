/**
 * 
 * Module handling ranking on Bing pages
 * 
 */


export class BingEventsHandler {
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

    async log_bing_ranking(tab_id, save_immediately) {
        function log_ranking(session_id, save_immediately) {
            class BaseEvent {
                constructor(session_id, timestamp=null) {
                    this.session_id = session_id;
                    this.timestamp = timestamp === null ? Date.now() : timestamp;
                }
            }

            class SearchEvent extends BaseEvent {
                constructor(session_id, query, filename_html, filename_ranking) {
                    super(session_id);
                    this.event = "search";
                    this.search_engine = "bing";
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

            function parse_search_content(element) {
                let description = element.querySelector("div.b_caption").innerText;
                if (description.length === 0) {
                    description = element.querySelector("p").innerText;
                }
                // Extract result texts and link
                let result = new ResultEntry(
                    element.querySelector("h2").innerText,
                    element.querySelector("h2 a").getAttribute("href"),
                    description
                )
                return result;
            }

            // Detects an Copilot summary at the start of the page
            function get_copilot_summary() {
                let container = document.querySelector("#b_topw");
                if (container && container.querySelector(".b_caption") == null) {
                    // Header is not a search entry
                    let overview = new AIOverviewEntry(container.querySelector(".answer_container").innerText);
                    return overview;
                } else {
                    container = document.querySelector("#b_genserp_container");
                    if (container) {
                        let overview = new AIOverviewEntry(container.innerText);
                        return overview;
                    }
                }
                return null;
            }

            var past_ranking = null;
            var curr_query = null;
            function save_bing_ranking(timestamp, should_submit_event) {
                // Avoid duplicates due to page loading signals from other content (within same page)
                if (window.__searchlog_last_export_timestamp && ((Date.now() - window.__searchlog_last_export_timestamp) < 1000) ) { return; }
                window.__searchlog_last_export_timestamp = Date.now();
                
                try {
                    const query_text = document.querySelector('#sb_form_q').getAttribute('value');
                    if (!curr_query) { curr_query = query_text; }
                    if (query_text !== curr_query) { return; } // User is typing new query (triggers observer). Don't save ranking
                    const filename_html = `${timestamp}_${query_text}.html`
                    const filename_ranking = `${timestamp}_${query_text}.json`
                    const event = new SearchEvent(session_id, query_text, filename_html, filename_ranking);
                    const html = document.documentElement.outerHTML;
                    let ranking = [];
        
                    // Look for Copilot summary
                    let ai_overview = get_copilot_summary();
                    if (ai_overview != null) {
                        ai_overview.rank = 0
                        ranking.push(ai_overview);
                    }
    
                    // Parse search results
                    let curr_rank = 1;
    
                    const top_container = document.querySelector("#b_topw");
                    if (top_container != null && top_container.querySelector(".b_caption") != null) {
                        // Header entry is a search result
                        let content = new ResultEntry(
                            top_container.querySelector("h2").innerText,
                            top_container.querySelector("h2 a").getAttribute("href"),
                            top_container.querySelector(".b_caption").textConteinnerTextnt + "\n" + top_container.querySelector("ul").innerText
                        )
                        content.rank = curr_rank;
                        curr_rank++;
                        ranking.push(content);
                    }
                    
                    // Other search results
                    const search_results_elements = document.querySelectorAll("#b_results li.b_algo");
                    for (const element of search_results_elements) {
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
                        "source": "bing",
                        "ranking": ranking
                    }, filename_ranking);
                } catch (e) {
                    console.error(e);
                }
            }

            (() => {
                // Run only on Bing
                if (!/^https:\/\/(www\.)?bing\.com\/search(\?|$)/i.test(window.location.href)) {
                    return;
                }

                const export_timestamp = Date.now();
                let last_export_timestamp = Date.now();
                
                if (save_immediately) {
                    save_bing_ranking(export_timestamp, true);
                }
                
                // Listen to page changes and update previous event/ranking (if needed)
                if (!window.__searchlog_observer_bing) {
                    window.__searchlog_observer_bing = new MutationObserver((mutations) => {
                        if (Date.now() - last_export_timestamp >= 1000) {
                            save_bing_ranking(export_timestamp, false);
                            last_export_timestamp = Date.now();
                        }
                    });
                    window.__searchlog_observer_bing.observe(document.body, { childList: true, subtree: true });
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
                window.__searchlog_observer_bing.disconnect();
                console.log("Closed Bing observer");
            } catch (e) {
                console.error(`Cannot stop Bing observer ${e}`);
            }
            window.__searchlog_last_export_timestamp = undefined;
            window.__searchlog_observer_bing = undefined;
        }

        await chrome.scripting.executeScript({
            target: { tabId: tab_id },
            func: stop_injected_listeners,
            args: []
        });
    }

    on_tab_updated(tab_id, changed_info, tab) {
        if (changed_info["status"] === "complete") {
            this.log_bing_ranking(tab_id, true);
        }
    }

    on_tab_focus(info) {
        this.log_bing_ranking(info.tabIds[0], false);
    }

    async start_listeners() {
        chrome.tabs.onUpdated.addListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.addListener(this.on_tab_focus);

        const curr_tab = (await chrome.tabs.query({currentWindow: true, active : true}))[0];
        this.log_bing_ranking(curr_tab.id, true);
    } 

    stop_listeners() {
        chrome.tabs.onUpdated.removeListener(this.on_tab_updated);
        chrome.tabs.onHighlighted.removeListener(this.on_tab_focus);
        for (const id of this.injected_tabs) {
            try {
                this.stop_observer(id);
            } catch (e) {
                console.warn(`Cannot stop Bing observer of tab ${id}`);
            }
        }
        this.injected_tabs = [];
    }
}