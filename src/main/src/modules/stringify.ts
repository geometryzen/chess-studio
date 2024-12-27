// Given anything, create a string from it.
// Helps with sending messages over IPC, displaying alerts, etc.

export function stringify(msg: unknown): string {
    try {
        if (msg instanceof Error) {
            msg = msg.toString();
        }
        if (typeof msg === "object") {
            msg = JSON.stringify(msg);
        }
        if (typeof msg === "undefined") {
            msg = "undefined";
        }
        msg = msg.toString().trim();
        return msg as string;
    } catch (err) {
        return "stringify() failed";
    }
}
