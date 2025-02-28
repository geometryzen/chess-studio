"use strict";

// Exports a function we use to draw alert messages.
// To be used in the main process only (so when the renderer needs to make an alert, it sends the message to main via IPC).

import { BaseWindow, dialog } from "electron";
import { stringify } from "./stringify.js";

let major_version = process && process.versions ? parseInt(process.versions.electron, 10) : 0;

if (Number.isNaN(major_version)) {
    major_version = 0;
}

let alerts_open = 0;

export function alert(...args: unknown[]) {
    // Can be called as  (msg)  or as  (win, msg)

    let win = args.length < 2 ? undefined : args[0];
    let msg = args.length < 2 ? args[0] : args[1];

    if (alerts_open >= 3) {
        return;
    }

    alerts_open++;

    if (major_version <= 5) {
        // Old API. Providing a callback makes the window not block the process...
        // This is all rather untested.
        /*
    if (win) {
      dialog.showMessageBox(win, {message: stringify(msg), title: "Alert", buttons: ["OK"]}, () => {
        alerts_open--;
      });
    } else {
      dialog.showMessageBox({message: stringify(msg), title: "Alert", buttons: ["OK"]}, () => {
        alerts_open--;
      });
    }
    */
    } else {
        // New promise-based API. Shouldn't block the process...

        if (win) {
            dialog.showMessageBox(win as BaseWindow, { message: stringify(msg), title: "Alert", buttons: ["OK"] }).then(() => {
                alerts_open--;
            });
        } else {
            dialog.showMessageBox({ message: stringify(msg), title: "Alert", buttons: ["OK"] }).then(() => {
                alerts_open--;
            });
        }
    }
}
