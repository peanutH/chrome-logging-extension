# SearchLog: A Chromium Extension for Capturing Search Logs in Laboratory Studies



## Introduction

A toolkit for collecting browser user interaction data for behavioral research studies.
Recorded data includes mouse and keyboard interactions, search engine queries, and tab and window operations.



## Description

The toolkit has two components:
- **Browser extension**: An extension for Chromium-based browsers that collects user interaction data.
- **Backend**: Local Flask server that receives the logged data from the extension and saves them to disk.

### Terminology

The following table summarizes the main terminology we use:
| **Term** | **Meaning** |
|---------------|----------------- |
| Session | One continuous logging interval during a participant's search task or study run, identified by a unique identifier. |
| Event | One structured object representing a browser- or page-level action such as tab switching, clicking, scrolling, keyboard input, or search activity. |
| Snapshot | The HTML file of a web page, used to have a representation of its content for later analysis. |
| Rankings | Parsed content of a search engine in a machine-readable format. |

### Modules Description

Logging is divided in four logical modules:

- **Mouse**: We capture all operations performed by the mouse cursor: clicks, scrolling, movement coordinates, text selection, and text hovering. In the main event logs, contiguous mouse movements are grouped. Raw data is provided in a separate log.

- **Keyboard**: We record all typed keys and commands such as copy, cut, paste, and selection. To preserve participants' privacy, all inputs on password fields are recorded with a generic placeholder.

- **Search**: We detect when a query is submitted to a search engine and keep track of the ranked search results the user obtained and AI overview features when shown. We store both an HTML snapshot of the page and a JSON file containing the preprocessed ranked results.

- **Browser:**: We record operations that involve the browser such as creating, switching, closing, and focusing on windows and tabs. We consider tab focus and loading completion events as those related to user interactions and save them in the main event logs. All tab/window events are also saved in a separate log.

### Validation
A technical validation is provided in `./validation`, containing the logging results of some scenarios to show the behavior of the toolkit.



## Installation

### Backend
To install the dependencies of the server, run the following command from the root of the repository:
```
pip install -r src/backend/requirements.txt
```

### Extension
The Chromium extension can be installed from the extensions panel: 
```
Open browser > Three dots > Extensions > Manage Extensions 
```
In the extensions panel:
- Toggle `Developer mode`,
- Click `Load unpacked`,
- Select the directory `src/extension`.



## Usage

To use the toolkit, the server has to be started first:
```
cd src/backend
python main.py
```

After the server starts, from the extension dialog on the browser, click `Begin Logging`. At the end of the session, logging can be stopped by clicking `End Logging` in the extension dialog.

By default, logs are saved in `./data`. To change the output directory, change the value `DATA_DIR` in `src/backend/.env`.



## Visualization Utility

Some visualization utilities are provided to plot mouse actions onto the web pages.


### Installation
```
pip install -r src/visualization/requirements.txt
```

### Usage
To plot mouse actions, run:
```
cd src/visualization
python mouse.py --session-dir=path-to-a-session-directory
```
Results are exported in the same session directory provided in input.



## Citation
If you use this toolkit for research, please cite it using the following entry:
```
@article{
    
} 
```