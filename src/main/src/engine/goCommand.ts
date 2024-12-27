export interface GoOptions {
    searchmoves?: string[];
    ponder?: boolean;
    wtime?: number;
    btime?: number;
    winc?: number;
    binc?: number;
    movestogo?: number;
    depth?: number;
    nodes?: number;
    mate?: number;
    movetime?: number;
    infinite?: boolean;
}

export function goCommand(options: GoOptions): string {
    let cmd = "go";

    if (Array.isArray(options.searchmoves)) {
        cmd += " searchmoves " + options.searchmoves.join(" ");
    }
    if (typeof options.ponder === "boolean" && options.ponder) {
        cmd += ` ponder`;
    }
    if (typeof options.wtime === "number") {
        cmd += ` wtime ${options.wtime}`;
    }
    if (typeof options.btime === "number") {
        cmd += ` btime ${options.btime}`;
    }
    if (typeof options.winc === "number") {
        cmd += ` winc ${options.winc}`;
    }
    if (typeof options.binc === "number") {
        cmd += ` binc ${options.binc}`;
    }
    if (typeof options.movestogo === "number") {
        cmd += ` movestogo ${options.movestogo}`;
    }
    if (typeof options.depth === "number") {
        cmd += ` depth ${options.depth}`;
    }
    if (typeof options.nodes === "number") {
        cmd += ` nodes ${options.nodes}`;
    }
    if (typeof options.mate === "number") {
        cmd += ` mate ${options.mate}`;
    }
    if (typeof options.movetime === "number") {
        cmd += ` movetime ${options.movetime}`;
    }
    if (typeof options.infinite === "boolean" && options.infinite) {
        cmd += ` infinite`;
    }

    return `${cmd}`;
}
