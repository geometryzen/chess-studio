"use strict";

import { LoadFEN } from "./fen";
import { KeyFromBoard } from "./polyglot";
import { Position } from "./Position";
import { Table } from "./Table";
import { DateString } from "./utils";

export function NewRoot(board?: Position): Node {
    // Arg is a board (position) object, not a FEN

    if (!board) {
        board = LoadFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    let root = new Node(null, null, board);

    // Tags. Only root gets these. Get overwritten by the PGN loader.
    // Internally, these get kept as HTML-safe, PGN-unsafe.

    const tags = Object.create(null);
    tags["Event"] = "?";
    tags["Site"] = "?";
    tags["Date"] = DateString(new Date());
    tags["Round"] = "?";
    tags["White"] = "White";
    tags["Black"] = "Black";
    tags["Result"] = "*";
    root.tags = tags;

    return root;
}

export let next_node_id = 1;
let live_nodes: Record<string, Node> = Object.create(null);

/**
 *
 */
export class Node {
    tags: Record<string, string> | null = null;
    id: number;
    children: Node[];
    parent: Node | null;
    move: string | null;
    board: Position;
    depth: number;
    table: Table;
    searchmoves: unknown[];
    __nice_move: unknown | null;
    destroyed: boolean;
    graph_length_knower: { val: number };

    constructor(parent: Node | null, move: string | null, board_for_root: Position | null) {
        // move must be legal; board is only relevant for root nodes

        this.id = next_node_id++;
        live_nodes[this.id.toString()] = this;

        if (parent) {
            parent.children.push(this);
            this.parent = parent;
            this.move = move;
            this.board = parent.board.move(move as string);
            this.depth = parent.depth + 1;
            this.graph_length_knower = parent.graph_length_knower; // 1 object every node points to, a bit lame
        } else {
            this.parent = null;
            this.move = null;
            this.board = board_for_root as Position;
            this.depth = 0;
            // this.graph_length_knower = { val: config.graph_minimum_length };
            this.graph_length_knower = { val: 41 };
        }

        if (this.depth + 1 > this.graph_length_knower.val) {
            this.graph_length_knower.val = this.depth + 1;
        }

        this.table = new Table();
        this.searchmoves = [];
        this.__nice_move = null;
        this.destroyed = false;
        this.children = [];
    }

    /**
     *
     * @param s must be exactly a legal move, including having promotion char iff needed (e.g. e2e1q)
     * @param force_new_node
     * @returns
     */
    make_move(s: string, force_new_node?: boolean): Node {

        if (!force_new_node) {
            for (let child of this.children) {
                if (child.move === s) {
                    return child;
                }
            }
        }

        return new Node(this, s, null);
    }

    history(): string[] {
        let ret: string[] = [];
        let node: Node | null = this;

        while (node && node.move) {
            ret.push(node.move);
            node = node.parent;
        }

        ret.reverse();
        return ret;
    }

    history_old_format() {
        // For engines that can't handle Chess960 format stuff.

        let ret: (string | null)[] = [];
        let node: Node | null = this;

        while (node && node.move) {
            ret.push(node.move_old_format());
            node = node.parent;
        }

        ret.reverse();
        return ret;
    }

    move_old_format() {
        let move = this.move;
        if (move === "e1h1" && this.parent!.board.state[4][7] === "K") return "e1g1";
        if (move === "e1a1" && this.parent!.board.state[4][7] === "K") return "e1c1";
        if (move === "e8h8" && this.parent!.board.state[4][0] === "k") return "e8g8";
        if (move === "e8a8" && this.parent!.board.state[4][0] === "k") return "e8c8";
        return move;
    }

    node_history(): Node[] {
        let ret: Node[] = [];
        let node: Node | null = this;

        while (node) {
            ret.push(node);
            node = node.parent;
        }

        ret.reverse();
        return ret;
    }

    all_graph_values(): (number | null)[] {
        // Call this on any node in the line will give the same result.

        let ret: (number | null)[] = [];
        let node: Node | null = this.get_end();

        while (node) {
            ret.push(node.table.get_graph_y());
            node = node.parent;
        }

        ret.reverse();
        return ret;
    }

    future_history() {
        return this.get_end().history();
    }

    future_node_history() {
        return this.get_end().node_history();
    }

    get_root(): Node {
        let node: Node = this;

        while (node.parent) {
            node = node.parent;
        }

        return node;
    }

    get_end(): Node {
        let node: Node = this;

        while (node.children.length > 0) {
            node = node.children[0];
        }

        return node;
    }

    return_to_main_line_helper(): Node {
        // Returns the node that "return to main line" should go to.

        let ret: Node = this;
        let node: Node = this;

        while (node.parent) {
            if (node.parent.children[0] !== node) {
                ret = node.parent;
            }
            node = node.parent;
        }

        return ret;
    }

    is_main_line(): boolean {
        let node: Node = this;

        while (node.parent) {
            if (node.parent.children[0] !== node) {
                return false;
            }
            node = node.parent;
        }

        return true;
    }

    is_same_line(other: Node): boolean {
        // This is not testing whether one is an ancestor of the other, but
        // rather whether the main lines of each end in the same place.

        // Easy case is when one is the parent of the other...

        if (this.parent === other) return other.children[0] === this;
        if (other.parent === this) return this.children[0] === other;

        return this.get_end() === other.get_end();
    }

    is_triple_rep() {
        // Are there enough ancestors since the last pawn move or capture?

        if (this.board.halfmove < 8) {
            return false;
        }

        let ancestor: Node = this;
        let hits = 0;

        while (ancestor.parent && ancestor.parent.parent) {
            ancestor = ancestor.parent.parent;
            if (ancestor.board.compare(this.board)) {
                hits++;
                if (hits >= 2) {
                    return true;
                }
            }

            // All further ancestors are the wrong side of a pawn move or capture?

            if (ancestor.board.halfmove < 2) {
                return false;
            }
        }

        return false;
    }

    nice_move() {
        if (this.__nice_move) {
            return this.__nice_move;
        }

        if (!this.move || !this.parent) {
            this.__nice_move = "??";
        } else {
            this.__nice_move = this.parent.board.nice_string(this.move);
        }

        return this.__nice_move;
    }

    token(stats_flag: boolean, force_number_flag?: boolean): string {
        // The complete token when writing the move, including number string if necessary,
        // which depends on position within variations etc and so cannot easily be cached.
        // We don't do brackets because closing brackets are complicated.

        if (!this.move || !this.parent) {
            return "";
        }

        let need_number_string = false;

        if (force_number_flag) need_number_string = true;
        if (!this.parent.parent) need_number_string = true;
        if (this.parent.board.active === "w") need_number_string = true;
        if (this.parent.children[0] !== this) need_number_string = true;

        // There are some other cases where we are supposed to have numbers but the logic
        // escapes me right now.

        let s = "";

        if (need_number_string) {
            s += this.parent.board.next_number_string() + " ";
        }

        s += this.nice_move();

        if (stats_flag) {
            /*
            let stats = this.make_stats();
            if (stats !== "") {
                s += " {" + stats + "}";
            }
            */
        }

        return s;
    }
    /*
    make_stats() {

        if (!this.parent) {
            return "";
        }

        let info = this.parent.table.moveinfo[this.move];
        let total_nodes = this.parent.table.nodes;

        if (!info || info.__ghost || info.__touched === false) {
            return "";
        }

        let sl = info.stats_list({
            ev_pov: config.ev_pov,
            cp_pov: config.cp_pov,
            wdl_pov: config.wdl_pov,
            ev: config.pgn_ev,
            cp: config.pgn_cp,
            n: config.pgn_n,
            n_abs: config.pgn_n_abs,
            of_n: config.pgn_of_n,
            depth: config.pgn_depth,
            wdl: config.pgn_wdl,
            p: config.pgn_p,
            m: config.pgn_m,
            v: config.pgn_v,
            q: config.pgn_q,
            u: config.pgn_u,
            s: config.pgn_s,
        }, total_nodes);

        return sl.join(", ");			// Will be "" on empty list
    }
    */

    end_nodes(): Node[] {
        if (this.children.length === 0) {
            return [this];
        } else {
            let list: Node[] = [];
            for (let child of this.children) {
                list = list.concat(child.end_nodes());
            }
            return list;
        }
    }

    terminal_reason() {
        // Returns "" if not a terminal position, otherwise returns the reason.
        // Also updates table.graph_y if needed.

        if (typeof this.table.terminal === "string") {
            return this.table.terminal;
        }

        let board = this.board;

        if (board.no_moves()) {
            if (board.king_in_check()) {
                this.table.set_terminal_info("Checkmate", board.active === "w" ? 0 : 1); // The PGN writer checks for this exact string! (Lame...)
            } else {
                this.table.set_terminal_info("Stalemate", 0.5);
            }
        } else if (board.insufficient_material()) {
            this.table.set_terminal_info("Insufficient Material", 0.5);
        } else if (board.halfmove >= 100) {
            this.table.set_terminal_info("50 Move Rule", 0.5);
        } else if (this.is_triple_rep()) {
            this.table.set_terminal_info("Triple Repetition", 0.5);
        } else {
            this.table.set_terminal_info("", null);
        }

        return this.table.terminal;
    }

    validate_searchmoves(arr: string[]) {
        // Returns a new array with only legal searchmoves.

        if (Array.isArray(arr) === false) {
            arr = [];
        }

        let valid_list: string[] = [];

        for (let move of arr) {
            if (this.board.illegal(move) === "") {
                valid_list.push(move);
            }
        }

        return valid_list;
    }

    detach() {
        // Returns the node that the hub should point to,
        // which is the parent unless the call is a bad one.

        let parent = this.parent;
        if (!parent) return this; // Fail

        parent.children = parent.children.filter((child) => child !== this);

        this.parent = null;
        DestroyTree(this);
        return parent;
    }
}

// ---------------------------------------------------------------------------------------------------------
// On the theory that it might help the garbage collector, we can
// destroy trees when we're done with them. Whether this is helpful
// in general I don't know, but we also take this opportunity to
// clear nodes from the live_list.

export function DestroyTree(node: Node): void {
    if (!node || node.destroyed) {
        console.log("Warning: DestroyTree() called with invalid arg");
        return;
    }
    __destroy_tree(node.get_root());
}

function __destroy_tree(node: Node) {
    // Non-recursive when possible...

    while (node.children.length === 1) {
        let child = node.children[0];

        node.parent = null;
        node.board = null as unknown as Position;
        node.children = null as unknown as Node[];
        node.searchmoves = null as unknown as unknown[];
        node.table = null as unknown as Table;
        node.graph_length_knower = null as unknown as { val: number };
        node.destroyed = true;

        delete live_nodes[node.id.toString()];

        node = child;
    }

    // Recursive when necessary...

    let children = node.children;

    node.parent = null;
    node.board = null as unknown as Position;
    node.children = null as unknown as Node[];
    node.searchmoves = null as unknown as unknown[];
    node.table = null as unknown as Table;
    node.graph_length_knower = null as unknown as { val: number };
    node.destroyed = true;

    delete live_nodes[node.id.toString()];

    for (let child of children) {
        __destroy_tree(child);
    }
}

// ---------------------------------------------------------------------------------------------------------
// Reset analysis and searchmove selections, recursively.

function CleanTree(node: Node): void {
    if (!node || node.destroyed) {
        return;
    }
    __clean_tree(node.get_root());
}

function __clean_tree(node: Node): void {
    // Non-recursive when possible...

    while (node.children.length === 1) {
        node.table.clear();
        node.searchmoves = [];
        node = node.children[0];
    }

    // Recursive when necessary...

    node.table.clear();
    node.searchmoves = [];

    for (let child of node.children) {
        __clean_tree(child);
    }
}

// ------------------------------------------------------------------------------------------------------
// Add positions to a book, using the given tree. No sorting here, needs to be done after completion.

function AddTreeToBook(node: Node, book: { key: bigint; move: string; weight: number }[]): { key: bigint; move: string; weight: number }[] {
    if (!book || Array.isArray(book) === false) {
        throw "AddTreeToBook called without valid array";
    }

    if (!node || node.destroyed) {
        return book;
    }

    __add_tree_to_book(node.get_root(), book);

    return book;
}

function __add_tree_to_book(node: Node, book: { key: bigint; move: string; weight: number }[]) {
    // Non-recursive when possible...

    while (node.children.length === 1) {
        let key = KeyFromBoard(node.board) as bigint;
        let move = node.children[0].move as string;

        book.push({
            // Duplicates allowed. This is improper.
            key: key,
            move: move,
            weight: 1
        });

        node = node.children[0];
    }

    if (node.children.length === 0) {
        // Do this test here, not at the start, since it can become true.
        return;
    }

    // Recursive when necessary...

    let key = KeyFromBoard(node.board) as bigint;

    for (let child of node.children) {
        book.push({
            // Duplicates allowed. This is improper.
            key: key,
            move: child.move as string,
            weight: 1
        });

        __add_tree_to_book(child, book);
    }
}
