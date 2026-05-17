# SearchLog: A Chrome Extension for Collecting Natural Search Logs in Laboratory Experiments



## Concepts

| **Term**      | **Meaning**                                                                                                                                        |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| Session       | One continuous logging interval during a participant's search task or study run, identified by a unique identifier.                                |
| Event         | One structured object representing a browser- or page-level action such as tab switching, clicking, scrolling, keyboard input, or search activity. |
| Snapshot      | The HTML file of a web page, used to have a representation of its content for later analysis.                                                      |
| Rankings      | Parsed content of a search engine in a machine-readable format.                                                                                    |
| Local backend | A Flask server running on the research machine that receives events and snapshots, creates session folders, and writes logs to disk.               |



## Modules Description

**Mouse.** We capture all operations performed by the mouse cursor: clicks, scrolling, movement coordinates, text selection, and text hovering.

**Keyboard.** We record all typed keys and commands such as copy, cut, paste, and selection. To preserve participants' privacy, all inputs on password fields are recorded with a generic placeholder.

**Search.** We detect when a query is submitted to a search engine and keep track of the ranked search results the user obtained and AI overview features when shown. We store both an HTML snapshot of the page and a JSON file containing the preprocessed ranked results.

**Browser.** We record operations that involve the browser such as creating, switching, closing, and focusing on windows and tabs.

