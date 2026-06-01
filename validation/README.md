# Validation


## Script 1: Basic Search Logging

The tester starts a new logging session and performs a simple Google Search task.
- Start the local backend server.
- Open the browser extension and start a new logging session.
- Go to Google Search.
- Search for: *history of coffee*.
- Wait until the search result page fully loads.
- Scroll down the result page.
- Click the first organic search result.
- Stay on the page for approximately 10 seconds.
- Scroll down the page.
- Return to the Google result page.
- Stop the logging session.


## Script 2: Tab and Window Behavior

The tester performs a search task involving multiple tabs.
- Start a new logging session.
- Go to Google Search.
- Search for: *best ways to learn Python*.
- Open the first result in a new tab.
- Return to the search results tab.
- Open the second result in a new tab.
- Switch between the two result tabs.
- Close one of the result tabs.
- Return to the original search results tab.
- Stop the logging session.


## Script 3: Mouse Interaction Logging

The tester performs a search task focused on mouse-based page interactions.
- Start a new logging session.
- Go to Google Search.
- Search for: *how solar panels work*.
- Click one organic result.
- Move the mouse across the page.
- Hover over a heading or paragraph.
- Select a short piece of text.
- Scroll to the middle of the page.
- Scroll back up.
- Click a link on the page if available.
- Stop the logging session.


## Script 4: Keyboard Logging

The tester performs actions involving typed input.
- Start a new logging session.
- Go to Google Search.
- Type the query: *climate change causes*.
- Submit the query.
- Click the search box again.
- Modify the query to: *main causes of climate change*.
- Submit the revised query.
- Open one result.
- If the page has a search box, type: *greenhouse gases*.
- Stop the logging session.


## Script 5: AI-generated Summary Logging

The tester performs searches that may trigger AI-generated summaries.
- Start a new logging session.
- Go to Google Search.
- Search for: *why do leaves change color in autumn*.
- Check whether an AI-generated summary appears.
- If an AI-generated summary appears, scroll within or near the AI-generated summary area if needed.
- Click one source link from the AI-generated summary if available.
- Return to the search result page.
- Search for: *how does photosynthesis work*.
- Check whether an AI-generated summary appears.
- Stop the logging session.


## Script 6: Privacy and Session Boundary Check

The tester checks whether logging only occurs during an active session and whether sensitive fields are handled appropriately.
- Start a new logging session.
- Go to Google Search.
- Search for: *public library near me*.
- Open any non-sensitive result.
- Stop the logging session.
- After stopping the session, search for: *weather tomorrow*.
- Open a new page after the session has ended.
- Start a new session.
- Open a test webpage with a password field.
- Type sample text into the password field, such as *testpassword123*.
- Stop the logging session.