"use strict";

import { basename } from "path";

// Is there not a better way? Perhaps some Electron API somewhere?

// TODO: See ngx-electron npm package.

export function running_as_electron(): boolean {
    return basename(process.argv[0]).toLowerCase().includes("electron");
}
