function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function dry_run () {
    try {
        // Create tabs
        const tab1 = await chrome.tabs.create({ url: "https://google.com", active: true });
        await sleep(1000);
        const tab2 = await chrome.tabs.create({ url: "https://bing.com", active: true });
        await sleep(1000);
        await chrome.tabs.remove(tab2.id);
        await sleep(500);

        await chrome.scripting.executeScript({ target: { tabId: tab1.id }, func: () => {
            (async () => {
                function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

                async function type_text(input, text) {
                    input.focus();
                    for (const char of text) {
                        input.dispatchEvent(new KeyboardEvent("keydown", { key: char, code: char, bubbles: true }));
                        input.dispatchEvent(new KeyboardEvent("keypress", { key: char, code: char, bubbles: true }));
                        input.value += char;
                        input.dispatchEvent(new Event("input", { bubbles: true }));
                        input.dispatchEvent(new KeyboardEvent("keyup", { key: char, code: char, bubbles: true }));
                        await sleep(100);
                    }
                }

                async function move_mouse(element, x, y) {
                    const opts = { bubbles: true, clientX: x, clientY: y };
                    element.dispatchEvent(new MouseEvent("mouseenter", opts));
                    element.dispatchEvent(new MouseEvent("mouseover", opts));
                    element.dispatchEvent(new MouseEvent("mousemove", opts));
                    sleep(500);
                    element.dispatchEvent(new MouseEvent("mousedown", opts));
                    element.dispatchEvent(new MouseEvent("mouseup", opts));
                    element.dispatchEvent(new MouseEvent("click", opts));
                }
                
                // Run some operations
                const query_input = document.querySelector('textarea[name="q"]');
                const search_button = document.querySelector('input[value="Google Search"][role="button"]');
                await type_text(query_input, "why is water wet");
                await move_mouse(search_button, 100, 200);
            })();
        }, args: [] });
        
        await sleep(5000);
        await chrome.tabs.remove(tab1.id);
    } catch (e) {
        console.error(e);
    }
}