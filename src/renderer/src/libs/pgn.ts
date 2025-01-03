import { Node } from "./Node";
import { SafeStringPGN, UnsafeStringHTML } from "./utils";

export function make_pgn_string(node: Node) {
    const root = node.get_root();
    let start_fen = root.position.fen(true);

    if (!root.tags) {
        // This should be impossible.
        root.tags = Object.create(null);
    }

    // Let's set the Result tag if possible...

    let main_line_end = root.get_end();
    let terminal_reason = main_line_end.terminal_reason();

    if (terminal_reason === "") {
        // Pass - leave it unchanged since we know nothing
    } else if (terminal_reason === "Checkmate") {
        root.tags!.Result = main_line_end.position.active === "w" ? "0-1" : "1-0";
    } else {
        root.tags!.Result = "1/2-1/2";
    }

    // Convert tag object to PGN formatted strings...

    let tags: string[] = [];

    for (let t of ["Event", "Site", "Date", "Round", "White", "Black", "Result"]) {
        const root_tags = root.tags;
        if (root_tags && root_tags[t]) {
            const escaped = UnsafeStringHTML(root_tags[t]);
            if (typeof escaped === "string") {
                let val = SafeStringPGN(escaped); // Undo HTML escaping then add PGN escaping.
                tags.push(`[${t} "${val}"]`);
            }
        }
    }

    if (start_fen !== "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1") {
        if (root.position.normalchess === false) {
            tags.push(`[Variant "Chess960"]`);
        }
        tags.push(`[FEN "${start_fen}"]`);
        tags.push(`[SetUp "1"]`);
    }

    let movetext = make_movetext(root);
    let final = tags.join("\n") + "\n\n" + movetext + "\n";
    return final;
}

function make_movetext(node: Node) {
    let root = node.get_root();
    let ordered_nodes = get_ordered_nodes(root);

    let tokens: string[] = [];

    for (let item of ordered_nodes) {
        if (item === root) continue;

        // As it stands, item could be a "(" or ")" string, or an actual node...

        if (typeof item === "string") {
            tokens.push(item);
        } else {
            let item_token = item.token(true);
            let subtokens = item_token.split(" ").filter((z) => z !== "");
            for (let subtoken of subtokens) {
                tokens.push(subtoken);
            }
        }
    }

    if (root.tags && root.tags.Result) {
        tokens.push(root.tags.Result);
    } else {
        tokens.push("*");
    }

    // Now it's all about wrapping to 80 chars...

    let lines = [];
    let line = "";

    for (let token of tokens) {
        if (line.length + token.length > 79) {
            if (line !== "") {
                lines.push(line);
            }
            line = token;
        } else {
            if (line.length > 0 && line.endsWith("(") === false && token !== ")") {
                line += " ";
            }
            line += token;
        }
    }
    if (line !== "") {
        lines.push(line);
    }

    return lines.join("\n");
}
// The following is to order the nodes into the order they would be written
// to screen or PGN. The result does contain root, which shouldn't be drawn.
//
// As a crude hack, the list also contains "(" and ")" elements to indicate
// where brackets should be drawn.

function get_ordered_nodes(node: Node): (Node | string)[] {
    let list: (Node | string)[] = [];
    __order_nodes(node, list, false);
    return list;
}

function __order_nodes(node: Node, list: (Node | string)[], skip_self_flag: boolean) {
    // Write this node itself...

    if (!skip_self_flag) {
        list.push(node);
    }

    // Write descendents as long as there's no branching,
    // or return if we reach a node with no children.

    while (node.children.length === 1) {
        node = node.children[0];
        list.push(node);
    }

    if (node.children.length === 0) {
        return;
    }

    // So multiple child nodes exist...

    let main_child = node.children[0];
    list.push(main_child);

    for (let child of node.children.slice(1)) {
        list.push("(");
        __order_nodes(child, list, false);
        list.push(")");
    }

    __order_nodes(main_child, list, true);
}
