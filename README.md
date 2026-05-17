# SearchLog: A Chrome Extension for Collecting Natural Search Logs in Laboratory Experiments


| **Term**      | **Meaning**                                                                                                                                        |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| Session       | One continuous logging interval during a participant's search task or study run, identified by a unique identifier.                                |
| Event         | One structured object representing a browser- or page-level action such as tab switching, clicking, scrolling, keyboard input, or search activity. |
| Snapshot      | The HTML file of a web page, used to have a representation of its content for later analysis.                                                      |
| Rankings      | Parsed content of a search engine in a machine-readable format.                                                                                    |
| Local backend | A Flask server running on the research machine that receives events and snapshots, creates session folders, and writes logs to disk.               |
