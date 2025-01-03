import { Node } from "./Node";
import { Position } from "./Position";

function NString(n: number) {
    const thousand = 1000;
    const million = 1000000;
    const billion = 1000000000;

    if (typeof n !== "number") {
        return "?";
    }

    if (n < thousand) {
        return n.toString();
    }

    if (n < 100 * thousand) {
        return (n / thousand).toFixed(1) + "k";
    }

    if (n < 999.5 * thousand) {
        return (n / thousand).toFixed(0) + "k";
    }

    if (n < 100 * million) {
        return (n / million).toFixed(1) + "M";
    }

    if (n < 999.5 * million) {
        return (n / million).toFixed(0) + "M";
    }

    if (n < 100 * billion) {
        return (n / billion).toFixed(1) + "B";
    }

    return (n / billion).toFixed(0) + "B";
}

function Value(q: number) {
    // Rescale Q to 0..1 range.
    if (typeof q !== "number") {
        return 0;
    }
    if (q < -1) {
        return 0;
    }
    if (q > 1) {
        return 1;
    }
    return (q + 1) / 2;
}

function Sign(n: number): 0 | 1 | -1 {
    if (n < 0) return -1;
    if (n > 0) return 1;
    return 0;
}

export function SortedMoveInfo(node: Node): Info[] {
    if (!node || node.destroyed) {
        return [];
    }

    return SortedMoveInfoFromTable(node.table);
}

function SortedMoveInfoFromTable(table: Table): Info[] {
    // There are a lot of subtleties around sorting the moves...
    //
    // - We want to allow other engines than Lc0.
    // - We want to work with low MultiPV values.
    // - Old and stale data can be left in our cache if MultiPV is low.
    // - We want to work with searchmoves, which is bound to leave stale info in the table.
    // - We can try and track the age of the data by various means, but these are fallible.

    let info_list: Info[] = [];
    let latest_cycle = 0;
    let latest_subcycle = 0;

    for (let o of Object.values(table.moveinfo)) {
        info_list.push(o);
        if (o.cycle > latest_cycle) latest_cycle = o.cycle;
        if (o.subcycle > latest_subcycle) latest_subcycle = o.subcycle;
    }

    // It's important that the sort be transitive. I believe it is.

    info_list.sort((a, b) => {
        const a_is_best = -1; // return -1 to sort a to the left
        const b_is_best = 1; // return 1 to sort a to the right

        // Info that hasn't been touched must be worse...

        if (a.__touched && !b.__touched) return a_is_best;
        if (!a.__touched && b.__touched) return b_is_best;

        // Always prefer info from the current "go" specifically.
        // As well as being correct generally, it also moves searchmoves to the top.

        if (a.cycle === latest_cycle && b.cycle !== latest_cycle) return a_is_best;
        if (a.cycle !== latest_cycle && b.cycle === latest_cycle) return b_is_best;

        // Prefer info from the current "block" of info specifically.

        if (a.subcycle === latest_subcycle && b.subcycle !== latest_subcycle) return a_is_best;
        if (a.subcycle !== latest_subcycle && b.subcycle === latest_subcycle) return b_is_best;

        // If one info is leelaish and the other isn't, that can only mean that the A/B
        // engine is the one that ran last (since Lc0 will cause all info to become
        // leelaish), therefore any moves the A/B engine has touched must be "better".

        if (!a.leelaish && b.leelaish) return a_is_best;
        if (a.leelaish && !b.leelaish) return b_is_best;

        // ----------------------------------- LEELA AND LEELA-LIKE ENGINES ----------------------------------- //

        if (a.leelaish && b.leelaish) {
            // Mate - positive good, negative bad.
            // Note our info struct uses 0 when not given.

            if (Sign(a.mate) !== Sign(b.mate)) {
                // negative is worst, 0 is neutral, positive is best
                if (a.mate > b.mate) return a_is_best;
                if (a.mate < b.mate) return b_is_best;
            } else {
                // lower (i.e. towards -Inf) is better regardless of who's mating
                if (a.mate < b.mate) return a_is_best;
                if (a.mate > b.mate) return b_is_best;
            }

            // Ordering by VerboseMoveStats (suggestion of Napthalin)...

            if (a.vms_order > b.vms_order) return a_is_best;
            if (a.vms_order < b.vms_order) return b_is_best;

            // Leela N score (node count) - higher is better (shouldn't be possible to get here now)...

            if (a.n > b.n) return a_is_best;
            if (a.n < b.n) return b_is_best;
        }

        // ---------------------------------------- ALPHA-BETA ENGINES ---------------------------------------- //

        if (a.leelaish === false && b.leelaish === false) {
            // Specifically within the latest subcycle, prefer lower multipv. I don't think this
            // breaks transitivity because the latest subcycle is always sorted left (see above).

            if (a.subcycle === latest_subcycle && b.subcycle === latest_subcycle) {
                if (a.multipv < b.multipv) return a_is_best;
                if (a.multipv > b.multipv) return b_is_best;
            }

            // Otherwise sort by depth.

            if (a.depth > b.depth) return a_is_best;
            if (a.depth < b.depth) return b_is_best;

            // Sort by CP if we somehow get here.

            if (a.cp > b.cp) return a_is_best;
            if (a.cp < b.cp) return b_is_best;
        }

        // Sort alphabetically...

        if (a.nice_pv_cache && b.nice_pv_cache) {
            if (a.nice_pv_cache[0] < b.nice_pv_cache[0]) return a_is_best;
            if (a.nice_pv_cache[0] > b.nice_pv_cache[0]) return b_is_best;
        }

        return 0;
    });

    return info_list;
}

/**
 * The table object stores info from the engine about a game-tree (PGN) node.
 */
export class Table {
    /**
     * The key is the UCI move i.e. long algebraic notation.
     */
    moveinfo: Record<string, Info>;
    version: number;
    nodes: number;
    nps: number;
    tbhits: number;
    time: number;
    limit: unknown;
    terminal: unknown;
    graph_y: number | null;
    graph_y_version: number;
    already_autopopulated: boolean;

    constructor() {
        this.moveinfo = Object.create(null); // move --> info
        this.version = 0; // Incremented on any change
        this.nodes = 0; // Stat sent by engine
        this.nps = 0; // Stat sent by engine
        this.tbhits = 0; // Stat sent by engine
        this.time = 0; // Stat sent by engine
        this.limit = null; // The limit of the last search that updated this.
        this.terminal = null; // null = unknown, "" = not terminal, "Non-empty string" = terminal reason
        this.graph_y = null; // Used by grapher only, value from White's POV between 0 and 1
        this.graph_y_version = 0; // Which version (above) was used to generate the graph_y value
        this.already_autopopulated = false;
    }

    clear() {
        this.moveinfo = Object.create(null); // move --> info
        this.version = 0; // Incremented on any change
        this.nodes = 0; // Stat sent by engine
        this.nps = 0; // Stat sent by engine
        this.tbhits = 0; // Stat sent by engine
        this.time = 0; // Stat sent by engine
        this.limit = null; // The limit of the last search that updated this.
        this.terminal = null; // null = unknown, "" = not terminal, "Non-empty string" = terminal reason
        this.graph_y = null; // Used by grapher only, value from White's POV between 0 and 1
        this.graph_y_version = 0; // Which version (above) was used to generate the graph_y value
        this.already_autopopulated = false;
    }

    get_graph_y() {
        // Naphthalin's scheme: based on centipawns.

        if (this.graph_y_version === this.version) {
            return this.graph_y;
        } else {
            let info = SortedMoveInfoFromTable(this)[0];
            if (info && !info.__ghost && info.__touched && (this.nodes > 1 || this.limit === 1)) {
                let cp = info.cp;
                if (info.board.active === "b") {
                    cp *= -1;
                }
                this.graph_y = 1 / (1 + Math.pow(0.5, cp / 100));
            } else {
                this.graph_y = null;
            }
            this.graph_y_version = this.version;
            return this.graph_y;
        }
    }
    set_terminal_info(reason: string, ev: number | null): void {
        // ev is ignored if reason is "" (i.e. not a terminal position)
        if (reason) {
            this.terminal = reason;
            this.graph_y = ev;
            this.graph_y_version = this.version;
        } else {
            this.terminal = "";
        }
    }

    autopopulate(node: Node): void {
        if (!node) {
            throw "autopopulate() requires node argument";
        }

        if (this.already_autopopulated) {
            return;
        }

        if (node.destroyed) {
            return;
        }

        const moves = node.board.movegen();

        for (let move of moves) {
            if (node.table.moveinfo[move] === undefined) {
                node.table.moveinfo[move] = new Info(node.board, move);
            }
        }

        this.already_autopopulated = true;
    }
}

/**
 * The info object stores info received from the engine about a move.
 * The actual updating of the object takes place in info.js and the ih.receive() method there.
 */
export class Info {
    board: Position;
    cp: number;
    depth: number;
    m: unknown;
    mate: number;
    multipv: number;
    n: number;
    p: number;
    q: number;
    s: number;
    seldepth: number;
    u: number;
    uci_nodes: number;
    v: unknown;
    vms_order: number;
    wdl: unknown;
    pv: string[];
    nice_pv_cache: string[] | null;
    __touched: unknown;
    __ghost: unknown;
    cycle: number;
    subcycle: number;
    leelaish: unknown;
    move: string;

    constructor(board: Position, move: string) {
        this.board = board;
        this.move = move;
        this.__ghost = false; // If not false, this is temporary inferred this.
        this.__touched = false; // Has this ever actually been updated?
        this.leelaish = false; // Whether the most recent update to this info was from an engine considered Leelaish.
        this.pv = [move]; // Validated as a legal sequence upon reception.
        this.cycle = 0; // How many "go" commands ChessStudio has emitted.
        this.subcycle = 0; // How many "blocks" of info we have seen (delineated by multipv 1 info).

        // Initialization to keep TypeScript compiler happy.
        // These are covered by clearing the stats.
        this.vms_order = 0;
        this.uci_nodes = 0;
        this.u = 0;
        this.seldepth = 0;
        this.s = 0;
        this.q = 0;
        this.p = 0;
        this.n = 0;
        this.multipv = 0;
        this.mate = 0;
        this.depth = 0;
        this.cp = 0;

        this.nice_pv_cache = [board.nice_string(move)];

        this.clear_stats();
    }

    // I'm not sure I've been conscientious everywhere in the code about checking whether these things are
    // of the right type, so for that reason most are set to some neutralish value by default.
    //
    // Exceptions: m, v, wdl (and note that all of these can be set to null by info.js)

    clear_stats() {
        this.cp = 0;
        this.depth = 0;
        this.m = null;
        this.mate = 0; // 0 can be the "not present" value.
        this.multipv = 1;
        this.n = 0;
        this.p = 0; // Note P is received and stored as a percent, e.g. 31.76 is a reasonable P.
        this.q = 0;
        this.s = 1; // Known as Q+U before Lc0 v0.25-rc2
        this.seldepth = 0;
        this.u = 1;
        this.uci_nodes = 0; // The number of nodes reported by the UCI info lines (i.e. for the whole position).
        this.v = null;
        this.vms_order = 0; // VerboseMoveStats order, 0 means not present, 1 is the worst, higher is better.
        this.wdl = null; // Either null or a length 3 array of ints.
    }

    set_pv(pv: string[]) {
        this.pv = Array.from(pv);
        this.nice_pv_cache = null;
    }

    nice_pv() {
        // Human readable moves.

        if (this.nice_pv_cache) {
            return Array.from(this.nice_pv_cache);
        }

        let tmp_board = this.board;

        if (!this.pv || this.pv.length === 0) {
            // Should be impossible.
            this.pv = [this.move];
        }

        let ret: string[] = [];

        for (let move of this.pv) {
            // if (tmp_board.illegal(move)) break;		// Should be impossible as of 1.8.4: PVs are validated upon reception, and the only other
            // way they can get changed is by maybe_infer_info(), which hopefully is sound.
            ret.push(tmp_board.nice_string(move));
            tmp_board = tmp_board.move(move);
        }

        this.nice_pv_cache = ret;
        return Array.from(this.nice_pv_cache);
    }

    value() {
        return Value(this.q); // Rescaled to 0..1
    }

    value_string(dp: number, pov: "w" | "b") {
        if (!this.__touched || typeof this.q !== "number") {
            return "?";
        }
        if (this.leelaish && this.n === 0) {
            return "?";
        }
        let val = this.value();
        if ((pov === "w" && this.board.active === "b") || (pov === "b" && this.board.active === "w")) {
            val = 1 - val;
        }
        return (val * 100).toFixed(dp);
    }

    cp_string(pov: "w" | "b") {
        if (!this.__touched || typeof this.cp !== "number") {
            return "?";
        }
        if (this.leelaish && this.n === 0) {
            return "?";
        }
        let cp = this.cp;
        if ((pov === "w" && this.board.active === "b") || (pov === "b" && this.board.active === "w")) {
            cp = 0 - cp;
        }
        let ret = (cp / 100).toFixed(2);
        if (cp > 0) {
            ret = "+" + ret;
        }
        return ret;
    }

    mate_string(pov: "w" | "b") {
        if (typeof this.mate !== "number" || this.mate === 0) {
            return "?";
        }
        let mate = this.mate;
        if ((pov === "w" && this.board.active === "b") || (pov === "b" && this.board.active === "w")) {
            mate = 0 - mate;
        }
        if (mate < 0) {
            return `(-M${0 - mate})`;
        } else {
            return `(+M${mate})`;
        }
    }

    wdl_string(pov: "w" | "b") {
        if (Array.isArray(this.wdl) === false || this.wdl.length !== 3) {
            return "?";
        }
        if ((pov === "w" && this.board.active === "b") || (pov === "b" && this.board.active === "w")) {
            return `${this.wdl[2]} ${this.wdl[1]} ${this.wdl[0]}`;
        } else {
            return `${this.wdl[0]} ${this.wdl[1]} ${this.wdl[2]}`;
        }
    }

    stats_list(
        opts: { ev: unknown; ev_pov: "w" | "b"; cp: unknown; cp_pov: "w" | "b"; n: unknown; n_abs: unknown; of_n: unknown; depth: unknown; p: unknown; v: unknown; q: unknown; u: unknown; s: unknown; m: unknown; wdl: unknown; wdl_pov: "w" | "b" },
        total_nodes: number
    ) {
        // We pass total_nodes rather than use this.uci_nodes which can be obsolete (e.g. due to searchmoves)

        if (this.__ghost) {
            return ["Inferred"];
        }

        let ret: string[] = [];

        if (opts.ev) {
            ret.push(`EV: ${this.value_string(1, opts.ev_pov)}%`);
        }

        if (opts.cp) {
            ret.push(`CP: ${this.cp_string(opts.cp_pov)}`);
        }

        // N is fairly complicated...

        if (this.leelaish) {
            if (typeof this.n === "number" && total_nodes) {
                // i.e. total_nodes is not zero or undefined

                let n_string = "";

                if (opts.n) {
                    n_string += ` N: ${((100 * this.n) / total_nodes).toFixed(2)}%`;
                }

                if (opts.n_abs) {
                    if (opts.n) {
                        n_string += ` [${NString(this.n)}]`;
                    } else {
                        n_string += ` N: ${NString(this.n)}`;
                    }
                }

                if (opts.of_n) {
                    n_string += ` of ${NString(total_nodes)}`;
                }

                if (n_string !== "") {
                    ret.push(n_string.trim());
                }
            } else {
                if (opts.n || opts.n_abs || opts.of_n) {
                    ret.push("N: ?");
                }
            }
        }

        // Everything else...

        if (!this.leelaish) {
            if (opts.depth) {
                if (typeof this.depth === "number" && this.depth > 0) {
                    ret.push(`Depth: ${this.depth}`);
                } else {
                    ret.push(`Depth: 0`);
                }
            }
        }

        if (this.leelaish) {
            if (opts.p) {
                if (typeof this.p === "number" && this.p > 0) {
                    ret.push(`P: ${this.p}%`);
                } else {
                    ret.push(`P: ?`);
                }
            }
            if (opts.v) {
                if (typeof this.v === "number") {
                    ret.push(`V: ${this.v.toFixed(3)}`);
                } else {
                    ret.push(`V: ?`);
                }
            }
        }

        if (opts.q) {
            if (typeof this.q === "number") {
                ret.push(`Q: ${this.q.toFixed(3)}`);
            } else {
                ret.push(`Q: ?`);
            }
        }

        if (this.leelaish) {
            if (opts.u) {
                if (typeof this.u === "number" && this.n > 0) {
                    // Checking n is correct.
                    ret.push(`U: ${this.u.toFixed(3)}`);
                } else {
                    ret.push(`U: ?`);
                }
            }
            if (opts.s) {
                if (typeof this.s === "number" && this.n > 0) {
                    // Checking n is correct.
                    ret.push(`S: ${this.s.toFixed(5)}`);
                } else {
                    ret.push(`S: ?`);
                }
            }
            if (opts.m) {
                if (typeof this.m === "number") {
                    if (this.m > 0) {
                        ret.push(`M: ${this.m.toFixed(1)}`);
                    } else {
                        ret.push(`M: 0`);
                    }
                } else {
                    ret.push(`M: ?`);
                }
            }
        }

        if (opts.wdl) {
            ret.push(`WDL: ${this.wdl_string(opts.wdl_pov)}`);
        }

        return ret;
    }
}
