export class BaseEvent {
    constructor(session_id, timestamp=null) {
        this.session_id = session_id
        this.timestamp = timestamp === null ? Date.now() : timestamp
    }
}