import { BehaviorSubject } from "rxjs";
import { LoadFEN } from "./fen";
import { DestroyTree, NewRoot, next_node_id, Node } from "./Node";
import { make_pgn_string } from "./pgn";
import { Position } from "./Position";
import { DateString } from "./utils";

export class Tree {
    /**
     * The root node of the analysis tree.
     */
    root: Node = NewRoot();
    /**
     * The current node in the analysis tree.
     */
    node: Node;
    /**
     * The version observable is initialized to zero.
     * It is incremented for the following reasons:
     *
     */
    readonly version$ = new BehaviorSubject(0);
    constructor() {
        this.node = this.root;
        this.node.position_info.ensure_candidate_moves(this.node);
    }
    /**
     *
     * @param fen The FEN for the position. Must be a valid position.
     */
    load(fen: string): void {
        const board = LoadFEN(fen);

        this.root = new Node(null, null, board);

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
        this.root.tags = tags;

        this.node = this.root;
        this.node.position_info.ensure_candidate_moves(this.node);
    }
    clear(): void {
        // We can't use LoadFEN here because the FEN gets validated.
        const board = new Position();
        // const board = LoadFEN("8/8/8/8/8/8/8/8 w KQkq - 0 1");

        this.root = new Node(null, null, board);

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
        this.root.tags = tags;

        this.node = this.root;
        this.node.position_info.ensure_candidate_moves(this.node);
    }
    turn(): "w" | "b" {
        return this.node.position.active;
    }
    isDrawByFiftyMoves(): boolean {
        const board = this.node.position;
        return board.halfmove >= 100; // 50 moves per side = 100 half moves
    }
    isCheck(): boolean {
        return this.node.position.king_in_check();
    }
    isCheckmate(): boolean {
        const board = this.node.position;
        return board.king_in_check() && board.no_moves();
    }
    isDraw(): boolean {
        return this.isDrawByFiftyMoves() || this.isStalemate() || this.isInsufficientMaterial() || this.isThreefoldRepetition();
    }
    isGameOver(): boolean {
        return this.isCheckmate() || this.isStalemate() || this.isDraw();
    }
    isInsufficientMaterial(): boolean {
        const board = this.node.position;
        return board.insufficient_material();
    }
    isStalemate(): boolean {
        const board = this.node.position;
        return !board.king_in_check() && board.no_moves();
    }
    isThreefoldRepetition(): boolean {
        return this.node.is_triple_rep();
    }
    fen(friendly_flag?: boolean): string {
        return this.node.position.fen(friendly_flag);
    }
    pgn(): string {
        return make_pgn_string(this.node);
    }
    reset(): void {
        this.root = NewRoot();
        this.node = this.root;
        this.node.position_info.ensure_candidate_moves(this.node);
    }
    private increment_version() {
        this.version$.next(this.version$.getValue() + 1);
    }
    replace_tree(root: Node) {
        DestroyTree(this.root);
        this.root = root;
        this.node = root;
        this.node.position_info.ensure_candidate_moves(this.node);
        this.increment_version();
        return true;
    }
    set_node(node: Node | null): boolean {
        // Note that we may call dom_easy_highlight_change() so don't
        // rely on this to draw any nodes that never got drawn.

        if (!node || node === this.node || node.destroyed) {
            return false;
        }

        let original_node = this.node;
        this.node = node;

        if (original_node.is_same_line(this.node)) {
            // This test is super-fast if one node is a parent of the other
            this.increment_version();
        } else {
            this.increment_version();
        }

        return true;
    }
    prev(): boolean {
        return this.set_node(this.node.parent); // OK if undefined
    }

    next(): boolean {
        return this.set_node(this.node.children[0]); // OK if undefined
    }
    goto_root(): boolean {
        return this.set_node(this.root);
    }

    goto_end(): boolean {
        return this.set_node(this.node.get_end());
    }

    previous_sibling(): boolean {
        if (!this.node.parent || this.node.parent.children.length < 2) {
            return false;
        }
        if (this.node.parent.children[0] === this.node) {
            return this.set_node(this.node.parent.children[this.node.parent.children.length - 1]);
        }
        for (let i = this.node.parent.children.length - 1; i > 0; i--) {
            if (this.node.parent.children[i] === this.node) {
                return this.set_node(this.node.parent.children[i - 1]);
            }
        }
        return false; // Can't get here.
    }

    next_sibling(): boolean {
        if (!this.node.parent || this.node.parent.children.length < 2) {
            return false;
        }
        if (this.node.parent.children[this.node.parent.children.length - 1] === this.node) {
            return this.set_node(this.node.parent.children[0]);
        }
        for (let i = 0; i < this.node.parent.children.length - 1; i++) {
            if (this.node.parent.children[i] === this.node) {
                return this.set_node(this.node.parent.children[i + 1]);
            }
        }
        return false; // Can't get here.
    }
    return_to_main_line(): boolean {
        let node = this.node.return_to_main_line_helper();
        if (this.node === node) {
            return false;
        }
        this.node = node;
        // DGH
        // this.dom_from_scratch();
        return true;
    }
    delete_node(): boolean {
        if (!this.node.parent) {
            this.delete_children();
            return false;
        }

        let parent = this.node.parent;
        this.node.detach();
        this.node = parent;
        this.increment_version();
        return true;
    }
    /**
     *
     * @param move must be exactly a legal move, including having promotion char iff needed (e.g. e2e1q)
     */
    make_move(move: string): void {
        // We want to detect whether making the move creates a new node in the tree.
        const orig_node_id = next_node_id;

        // The current node becomes the node
        this.node = this.node.make_move(move);

        this.node.position_info.ensure_candidate_moves(this.node);

        //
        if (next_node_id !== orig_node_id) {
            // A node was constructed as a result of the move.
            this.increment_version();
        } else {
            // A node was not constructed as a result of the move because it already existed.
        }
        this.node.position_info.ensure_candidate_moves(this.node);
    }

    make_move_sequence(moves: string[], set_this_node = true): boolean {
        if (Array.isArray(moves) === false || moves.length === 0) {
            return false;
        }

        let next_node_id__initial = next_node_id;

        let node = this.node;
        for (let s of moves) {
            node = node.make_move(s); // Calling the node's make_move() method, not handler's
        }

        if (set_this_node) {
            this.node = node;
        }

        if (next_node_id !== next_node_id__initial) {
            // NewNode() was called
            this.increment_version();
        }

        return true;
    }

    add_move_sequence(moves: string[]): boolean {
        return this.make_move_sequence(moves, false);
    }

    // -------------------------------------------------------------------------------------------------------------
    // The following methods don't ever change this.node - so the caller has no action to take. No return value.

    promote_to_main_line() {
        let node = this.node;
        let changed = false;

        while (node.parent) {
            if (node.parent.children[0] !== node) {
                for (let n = 1; n < node.parent.children.length; n++) {
                    if (node.parent.children[n] === node) {
                        node.parent.children[n] = node.parent.children[0];
                        node.parent.children[0] = node;
                        changed = true;
                        break;
                    }
                }
            }
            node = node.parent;
        }

        if (changed) {
            this.increment_version();
        }
    }

    promote() {
        let node = this.node;
        let changed = false;

        while (node.parent) {
            if (node.parent.children[0] !== node) {
                for (let n = 1; n < node.parent.children.length; n++) {
                    if (node.parent.children[n] === node) {
                        let swapper = node.parent.children[n - 1];
                        node.parent.children[n - 1] = node;
                        node.parent.children[n] = swapper;
                        changed = true;
                        break;
                    }
                }
                break; // 1 tree change only
            }
            node = node.parent;
        }

        if (changed) {
            this.increment_version();
        }
    }

    delete_other_lines() {
        this.promote_to_main_line();

        let changed = false;
        let node = this.root;

        while (node.children.length > 0) {
            for (let child of node.children.slice(1)) {
                child.detach();
                changed = true;
            }
            node = node.children[0];
        }

        if (changed) {
            this.increment_version(); // This may be the 2nd draw since promote_to_main_line() may have drawn. Bah.
        }
    }

    delete_children() {
        if (this.node.children.length > 0) {
            for (let child of this.node.children) {
                child.detach();
            }
            this.increment_version();
        }
    }

    delete_siblings() {
        let changed = false;

        if (this.node.parent) {
            for (let sibling of this.node.parent.children) {
                if (sibling !== this.node) {
                    sibling.detach();
                    changed = true;
                }
            }
        }

        if (changed) {
            this.increment_version();
        }
    }
}
