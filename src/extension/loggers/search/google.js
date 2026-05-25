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
                await chrome.runtime.sendMessage({ action: "submit-log", log: JSON.stringify(event) });
            }

            async function submit_html(html, name) {
                await chrome.runtime.sendMessage({ action: "submit-html", data: JSON.stringify({ session_id: session_id, name: name, html: html }) });
            }

            async function submit_ranking(ranking, name) {
                await chrome.runtime.sendMessage({ action: "submit-ranking", data: JSON.stringify({ session_id: session_id, name: name, ranking: ranking }) });
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
                }
                catch (e) {
                    return null;
                }
                
            }

            var past_ranking = null;
            function save_google_ranking(timestamp) {
                // Run only on Google
                if (!/^https?:\/\/(?:[^/]+\.)?google\.[a-z.]+\/search(?:\?|$)/i.test(window.location.href)) {
                    return;
                }

                // Avoid duplicates due to page loading signals from other content (within same page)
                if (document.__last_export_timestamp && ((Date.now() - document.__last_export_timestamp) < 500) ) { return; }
                document.__last_export_timestamp = Date.now();

                const query_text = document.querySelector('textarea[name="q"]').getAttribute('value');
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
    
                submit_event(event);
                submit_html(html, filename_html);
                submit_ranking({
                    "source": "google",
                    "ranking": ranking
                }, filename_ranking);
            }

            (() => {
                const export_timestamp = Date.now();
                let last_export_timestamp = Date.now();
                
                save_google_ranking(export_timestamp);

                // Listen to page changes and update previous event/ranking (if needed)
                const observer = new MutationObserver((mutations) => {
                    if (Date.now() - last_export_timestamp >= 1000) {
                        save_google_ranking(export_timestamp);
                        last_export_timestamp = Date.now();
                    }
                });
                document.addEventListener('DOMContentLoaded', () => {
                    observer.observe(document.querySelector("#rcnt"), { childList: true, subtree: true });
                });
            })();
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