import { replace_all } from "./replace_all";

function coords_from_algebraic(s: string): [number, number] {
    // e.g. "b7" --> [1, 1]
    if (typeof s !== "string" || s.length !== 2) {
        return [-1, -1];
    }
    s = s.toLowerCase();
    let x = s.charCodeAt(0) - 97;
    let y = 8 - parseInt(s[1], 10);
    if (x < 0 || x > 7 || y < 0 || y > 7 || Number.isNaN(y)) {
        return [-1, -1];
    }
    return [x, y];
}

/**
 * The only place this is used is in the generation of the coordinate lookup table.
 * This means that the inputs are guaranteed to be in range.
 * An exception is raised if the inputs are not correct.
 * @param x
 * @param y
 * @returns
 */
function algebraic_from_coords(x: number, y: number): Square {
    // e.g. (1, 1) --> "b7"
    if (typeof x !== "number" || typeof y !== "number" || x < 0 || x > 7 || y < 0 || y > 7) {
        throw new Error();
    }
    const xs = String.fromCharCode(x + 97);
    const ys = String.fromCharCode(8 - y + 48);
    return (xs + ys) as Square;
}

export type Square =
    | "a8"
    | "b8"
    | "c8"
    | "d8"
    | "e8"
    | "f8"
    | "g8"
    | "h8"
    | "a7"
    | "b7"
    | "c7"
    | "d7"
    | "e7"
    | "f7"
    | "g7"
    | "h7"
    | "a6"
    | "b6"
    | "c6"
    | "d6"
    | "e6"
    | "f6"
    | "g6"
    | "h6"
    | "a5"
    | "b5"
    | "c5"
    | "d5"
    | "e5"
    | "f5"
    | "g5"
    | "h5"
    | "a4"
    | "b4"
    | "c4"
    | "d4"
    | "e4"
    | "f4"
    | "g4"
    | "h4"
    | "a3"
    | "b3"
    | "c3"
    | "d3"
    | "e3"
    | "f3"
    | "g3"
    | "h3"
    | "a2"
    | "b2"
    | "c2"
    | "d2"
    | "e2"
    | "f2"
    | "g2"
    | "h2"
    | "a1"
    | "b1"
    | "c1"
    | "d1"
    | "e1"
    | "f1"
    | "g1"
    | "h1";

export interface Point {
    x: number;
    y: number;
    s: Square;
}

function numbers_between(a: number, b: number): number[] {
    // Given integers a and b, return a list of integers between the two, inclusive.

    let step = a < b ? 1 : -1;

    let ret: number[] = [];

    for (let x = a; x !== b; x += step) {
        ret.push(x);
    }

    ret.push(b);

    return ret;
}

const xy_lookup: Readonly<Point>[][] = [];
for (let x = 0; x < 8; x++) {
    xy_lookup.push([]);
    for (let y = 0; y < 8; y++) {
        xy_lookup[x].push({ x: -1, y: -1, s: "" as Square });
    }
}
for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
        let s = algebraic_from_coords(x, y);
        let point = Object.freeze({ x, y, s });
        xy_lookup[x][y] = point;
    }
}

function generate_movegen_sliders(): Record<string, number[][][]> {
    let invert = (n: number) => (n === 0 ? 0 : -n); // Flip sign without introducing -0
    let rotate = (xy: number[]) => [invert(xy[1]), xy[0]]; // Rotate a single vector of form [x,y]
    let flip = (xy: number[]) => [invert(xy[0]), xy[1]]; // Flip a single vector, horizontally

    let ret: Record<string, number[][][]> = Object.create(null);

    // For each of B, R, N, make an initial slider and place it in a new list as item 0...
    ret["B"] = [
        [
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
            [5, 5],
            [6, 6],
            [7, 7]
        ]
    ];
    ret["R"] = [
        [
            [1, 0],
            [2, 0],
            [3, 0],
            [4, 0],
            [5, 0],
            [6, 0],
            [7, 0]
        ]
    ];
    ret["N"] = [[[1, 2]]];

    // Add 3 rotations for each...
    for (let n = 0; n < 3; n++) {
        ret["B"].push(ret["B"][n].map(rotate));
        ret["R"].push(ret["R"][n].map(rotate));
        ret["N"].push(ret["N"][n].map(rotate));
    }

    // Add the knight mirrors (knights have 8 sliders of length 1)...
    ret["N"] = ret["N"].concat(ret["N"].map((slider) => slider.map(flip)));

    // Make the queen from the rook and bishop...
    ret["Q"] = ret["B"].concat(ret["R"]);

    // The black lowercase versions can point to the same objects...
    for (let key of Object.keys(ret)) {
        ret[key.toLowerCase()] = ret[key];
    }

    // Make the pawns...
    ret["P"] = [
        [
            [0, -1],
            [0, -2]
        ],
        [[-1, -1]],
        [[1, -1]]
    ];
    ret["p"] = [
        [
            [0, 1],
            [0, 2]
        ],
        [[-1, 1]],
        [[1, 1]]
    ];

    return ret;
}

const movegen_sliders = generate_movegen_sliders();

export function point_from_xy(a: number, b: number): Readonly<Point> | null {
    // Each Point is represented by a single object so that naive equality checking works, i.e.
    // Point(x, y) === Point(x, y) should be true. Since object comparisons in JS will be false
    // unless they are the same object, we do the following...
    //
    // Returns null on invalid input, therefore the caller should take care to ensure that the
    // value is not null before accessing .x or .y or .s!

    // Point("a8") or Point(0, 0) are both valid.

    let col = xy_lookup[a];
    if (col === undefined) {
        return null;
    }

    let ret = col[b];
    if (ret === undefined) {
        return null;
    }

    return ret;
}

export function point_from_s(s: string): Readonly<Point> | null {
    // Each Point is represented by a single object so that naive equality checking works, i.e.
    // Point(x, y) === Point(x, y) should be true. Since object comparisons in JS will be false
    // unless they are the same object, we do the following...
    //
    // Returns null on invalid input, therefore the caller should take care to ensure that the
    // value is not null before accessing .x or .y or .s!

    // Point("a8") or Point(0, 0) are both valid.

    const [a, b] = coords_from_algebraic(s); // Possibly [-1, -1] if invalid

    return point_from_xy(a, b);
}

export function assert_point(maybe: Readonly<Point> | null): Readonly<Point> | never {
    if (maybe) {
        return maybe;
    } else {
        throw new Error("");
    }
}

export class Position {
    castling: string = "";
    active: "w" | "b" = "w";
    state: string[][] = [
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""]
    ];
    fullmove: number = 1;
    halfmove: number = 0;
    enpassant: Readonly<Point> | null = null;
    normalchess: boolean = false;

    move(s: string): Position {
        // s is some valid UCI move like "d1f3" or "e7e8q". For the most part, this function
        // assumes the move is legal - all sorts of weird things can happen if this isn't so.
        //
        // As an exception, note that position.illegal() does call this to make a temp board
        // that can be used to test for moves that leave the king in check, so this method
        // must "work" for such illegal moves.

        if (typeof s !== "string" || s.length < 4) {
            console.log("Position.move called with arg", s);
            return this;
        }

        // s = this.c960_castling_converter(s);		// Too many ramifications to think about.

        let [x1, y1] = coords_from_algebraic(s.slice(0, 2));
        let [x2, y2] = coords_from_algebraic(s.slice(2, 4));

        if (x1 < 0 || y1 < 0 || x1 > 7 || y1 > 7 || x2 < 0 || y2 < 0 || x2 > 7 || y2 > 7) {
            console.log("Position.move called with arg", s);
            return this;
        }

        if (this.state[x1][y1] === "") {
            console.log("position_prototype.move called with empty source, arg was", s);
            return this;
        }

        let ret = this.copy();

        let promotion_char = s.length > 4 ? s[4].toLowerCase() : "q";

        let white_flag = ret.is_white(point_from_xy(x1, y1));
        let pawn_flag = ret.state[x1][y1] === "P" || ret.state[x1][y1] === "p";
        let castle_flag = (ret.state[x2][y2] === "R" && white_flag) || (ret.state[x2][y2] === "r" && white_flag === false);
        let capture_flag: boolean = castle_flag === false && !!ret.state[x2][y2];

        if (pawn_flag && x1 !== x2) {
            // Make sure capture_flag is set even for enpassant captures
            capture_flag = true;
        }

        // Update castling info...

        if (y1 === 7 && ret.state[x1][y1] === "K") {
            ret.__delete_white_castling();
        }

        if (y1 === 0 && ret.state[x1][y1] === "k") {
            ret.__delete_black_castling();
        }

        if (y1 === 7 && ret.state[x1][y1] === "R") {
            // White rook moved.
            let ch = String.fromCharCode(x1 + 65);
            ret.__delete_castling_char(ch);
        }

        if (y2 === 7 && ret.state[x2][y2] === "R") {
            // White rook was captured (or castled onto).
            let ch = String.fromCharCode(x2 + 65);
            ret.__delete_castling_char(ch);
        }

        if (y1 === 0 && ret.state[x1][y1] === "r") {
            // Black rook moved.
            let ch = String.fromCharCode(x1 + 97);
            ret.__delete_castling_char(ch);
        }

        if (y2 === 0 && ret.state[x2][y2] === "r") {
            // Black rook was captured (or castled onto).
            let ch = String.fromCharCode(x2 + 97);
            ret.__delete_castling_char(ch);
        }

        // Update halfmove and fullmove...

        if (white_flag === false) {
            ret.fullmove++;
        }

        if (pawn_flag || capture_flag) {
            ret.halfmove = 0;
        } else {
            ret.halfmove++;
        }

        // Handle the moves of castling...

        if (castle_flag) {
            let k_ch = ret.state[x1][y1];
            let r_ch = ret.state[x2][y2];

            if (x2 > x1) {
                // Kingside castling

                ret.state[x1][y1] = "";
                ret.state[x2][y2] = "";
                ret.state[6][y1] = k_ch;
                ret.state[5][y1] = r_ch;
            } else {
                // Queenside castling

                ret.state[x1][y1] = "";
                ret.state[x2][y2] = "";
                ret.state[2][y1] = k_ch;
                ret.state[3][y1] = r_ch;
            }
        }

        // Handle enpassant captures...

        if (pawn_flag && capture_flag && ret.state[x2][y2] === "") {
            ret.state[x2][y1] = "";
        }

        // Set the enpassant square... only if potential capturing pawns are present. Note
        // there are some subtleties where the pawns could be present but the capture is
        // illegal. We ignore this issue.
        //
        // The worst consequence is a false negative in the compare() method, leading to a
        // triple repetition not being recognised (until it becomes a quadruple
        // repetition). This seems fairly harmless.
        //
        // Note that the code below relies on Point() generating null for offboard
        // coordinates, and ret.piece() accepting that null.

        ret.enpassant = null;

        if (pawn_flag && y1 === 6 && y2 === 4) {
            // White pawn advanced 2
            if (ret.piece(point_from_xy(x1 - 1, 4)) === "p" || ret.piece(point_from_xy(x1 + 1, 4)) === "p") {
                ret.enpassant = point_from_xy(x1, 5);
            }
        }

        if (pawn_flag && y1 === 1 && y2 === 3) {
            // Black pawn advanced 2
            if (ret.piece(point_from_xy(x1 - 1, 3)) === "P" || ret.piece(point_from_xy(x1 + 1, 3)) === "P") {
                ret.enpassant = point_from_xy(x1, 2);
            }
        }

        // Actually make the move (except we already did castling)...

        if (castle_flag === false) {
            ret.state[x2][y2] = ret.state[x1][y1];
            ret.state[x1][y1] = "";
        }

        // Handle promotions...

        if (y2 === 0 && pawn_flag) {
            ret.state[x2][y2] = promotion_char.toUpperCase();
        }

        if (y2 === 7 && pawn_flag) {
            ret.state[x2][y2] = promotion_char; // Always lowercase.
        }

        // Swap who the current player is...

        ret.active = white_flag ? "b" : "w";

        return ret;
    }

    __delete_castling_char(delete_char: string) {
        let new_rights = "";
        for (let ch of this.castling) {
            if (ch !== delete_char) {
                new_rights += ch;
            }
        }
        this.castling = new_rights;
    }

    __delete_white_castling(): void {
        let new_rights = "";
        for (let ch of this.castling) {
            if ("a" <= ch && ch <= "h") {
                // i.e. black survives
                new_rights += ch;
            }
        }
        this.castling = new_rights;
    }

    __delete_black_castling(): void {
        let new_rights = "";
        for (let ch of this.castling) {
            if ("A" <= ch && ch <= "H") {
                // i.e. white survives
                new_rights += ch;
            }
        }
        this.castling = new_rights;
    }

    illegal(s: string): string {
        // Returns "" if the move is legal, otherwise returns the reason it isn't.

        if (typeof s !== "string") {
            return "not a string";
        }

        // s = this.c960_castling_converter(s);		// Too many ramifications to think about.

        let [x1, y1] = coords_from_algebraic(s.slice(0, 2));
        let [x2, y2] = coords_from_algebraic(s.slice(2, 4));

        if (x1 < 0 || y1 < 0 || x1 > 7 || y1 > 7 || x2 < 0 || y2 < 0 || x2 > 7 || y2 > 7) {
            return "off board";
        }

        if (this.active === "w" && this.is_white(point_from_xy(x1, y1)) === false) {
            return "wrong color source";
        }

        if (this.active === "b" && this.is_black(point_from_xy(x1, y1)) === false) {
            return "wrong color source";
        }

        // Colors must not be the same, except for castling.
        // Note that king-onto-rook is the only valid castling move...

        if (this.same_color(point_from_xy(x1, y1), point_from_xy(x2, y2))) {
            if (this.state[x1][y1] === "K" && this.state[x2][y2] === "R") {
                return this.illegal_castling(x1, y1, x2, y2);
            } else if (this.state[x1][y1] === "k" && this.state[x2][y2] === "r") {
                return this.illegal_castling(x1, y1, x2, y2);
            } else {
                return "source and destination have same color";
            }
        }

        if (["N", "n"].includes(this.state[x1][y1])) {
            if (Math.abs(x2 - x1) + Math.abs(y2 - y1) !== 3) {
                return "illegal knight movement";
            }
            if (Math.abs(x2 - x1) === 0 || Math.abs(y2 - y1) === 0) {
                return "illegal knight movement";
            }
        }

        if (["B", "b"].includes(this.state[x1][y1])) {
            if (Math.abs(x2 - x1) !== Math.abs(y2 - y1)) {
                return "illegal bishop movement";
            }
        }

        if (["R", "r"].includes(this.state[x1][y1])) {
            if (Math.abs(x2 - x1) > 0 && Math.abs(y2 - y1) > 0) {
                return "illegal rook movement";
            }
        }

        if (["Q", "q"].includes(this.state[x1][y1])) {
            if (Math.abs(x2 - x1) !== Math.abs(y2 - y1)) {
                if (Math.abs(x2 - x1) > 0 && Math.abs(y2 - y1) > 0) {
                    return "illegal queen movement";
                }
            }
        }

        // Pawns...

        if (["P", "p"].includes(this.state[x1][y1])) {
            if (Math.abs(x2 - x1) === 0) {
                if (this.state[x2][y2]) {
                    return "pawn cannot capture forwards";
                }
            }

            if (Math.abs(x2 - x1) > 1) {
                return "pawn cannot move that far sideways";
            }

            if (Math.abs(x2 - x1) === 1) {
                if (this.state[x2][y2] === "") {
                    if (this.enpassant !== point_from_xy(x2, y2)) {
                        return "pawn cannot capture thin air";
                    }
                }

                if (Math.abs(y2 - y1) !== 1) {
                    return "pawn must move 1 forward when capturing";
                }
            }

            if (this.state[x1][y1] === "P") {
                if (y1 !== 6) {
                    if (y2 - y1 !== -1) {
                        return "pawn must move forwards 1";
                    }
                } else {
                    if (y2 - y1 !== -1 && y2 - y1 !== -2) {
                        return "pawn must move forwards 1 or 2";
                    }
                }
            }

            if (this.state[x1][y1] === "p") {
                if (y1 !== 1) {
                    if (y2 - y1 !== 1) {
                        return "pawn must move forwards 1";
                    }
                } else {
                    if (y2 - y1 !== 1 && y2 - y1 !== 2) {
                        return "pawn must move forwards 1 or 2";
                    }
                }
            }
        }

        // Kings...

        if (["K", "k"].includes(this.state[x1][y1])) {
            if (Math.abs(y2 - y1) > 1) {
                return "illegal king movement";
            }

            if (Math.abs(x2 - x1) > 1) {
                return "illegal king movement";
            }
        }

        // Check for blockers (pieces between source and dest).

        if (["K", "Q", "R", "B", "P", "k", "q", "r", "b", "p"].includes(this.state[x1][y1])) {
            if (this.los(x1, y1, x2, y2) === false) {
                return "movement blocked";
            }
        }

        // Check promotion and string lengths...
        // We DO NOT tolerate missing promotion characters.

        if ((y1 === 1 && this.state[x1][y1] === "P") || (y1 === 6 && this.state[x1][y1] === "p")) {
            if (s.length !== 5) {
                return "bad string length";
            }

            let promotion = s[4];

            if (promotion !== "q" && promotion !== "r" && promotion !== "b" && promotion !== "n") {
                return "move requires a valid promotion piece";
            }
        } else {
            if (s.length !== 4) {
                return "bad string length";
            }
        }

        // Check for check...

        let tmp = this.move(s);
        if (tmp.can_capture_king()) {
            return "king in check";
        }

        return "";
    }

    illegal_castling(x1: number, y1: number, x2: number, y2: number) {
        // We can assume a king is on [x1, y1] and a same-color rook is on [x2, y2]

        if (y1 !== y2) {
            return "cannot castle vertically";
        }

        let color = this.color(point_from_xy(x1, y1));

        if (color === "w" && y1 !== 7) {
            return "cannot castle off the back rank";
        }

        if (color === "b" && y1 !== 0) {
            return "cannot castle off the back rank";
        }

        // Check for the required castling rights character...

        let required_ch;

        if (color === "w") {
            required_ch = assert_point(point_from_xy(x2, y2)).s[0].toUpperCase();
        } else {
            required_ch = assert_point(point_from_xy(x2, y2)).s[0];
        }

        if (this.castling.includes(required_ch) === false) {
            return `lost the right to castle - needed ${required_ch}`;
        }

        let king_target_x;
        let rook_target_x;

        if (x1 < x2) {
            // Castling kingside
            king_target_x = 6;
            rook_target_x = 5;
        } else {
            // Castling queenside
            king_target_x = 2;
            rook_target_x = 3;
        }

        let king_path = numbers_between(x1, king_target_x);
        let rook_path = numbers_between(x2, rook_target_x);

        // Check for blockers and checks...

        for (let x of king_path) {
            if (this.attacked(point_from_xy(x, y1), this.active)) {
                return "cannot castle [out of / through / into] check";
            }
            if (x === x1 || x === x2) {
                continue; // After checking for checks
            }
            if (this.state[x][y1]) {
                return "castling blocked for king movement";
            }
        }

        for (let x of rook_path) {
            if (x === x1 || x === x2) {
                continue;
            }
            if (this.state[x][y1]) {
                return "castling blocked for rook movement";
            }
        }

        // Check that the king doesn't end up in check anyway...
        // q1nnkbbr/p1pppppp/8/1P6/8/3NN3/1PPPPPPP/rR2KBBR w BHh - 0 5

        let tmp = this.move(assert_point(point_from_xy(x1, y1)).s + assert_point(point_from_xy(x2, y2)).s);

        if (tmp.attacked(point_from_xy(king_target_x, y1), this.active)) {
            return "king ends in check";
        }

        return "";
    }

    sequence_illegal(moves: string[]): string {
        let pos: Position = this;

        for (let s of moves) {
            let reason = pos.illegal(s);
            if (reason) {
                return `${s} - ${reason}`;
            }
            pos = pos.move(s);
        }

        return "";
    }

    can_capture_king(): boolean {
        // Can the side to move capture the opponent's king? Helper function for illegal() etc.
        // But this is slow, do not use when king location is known - just call attacked() instead.

        let kch = this.active === "w" ? "k" : "K"; // i.e. the INACTIVE king
        let opp_color: "w" | "b" = this.active === "w" ? "b" : "w";

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                if (this.state[x][y] === kch) {
                    return this.attacked(point_from_xy(x, y), opp_color);
                }
            }
        }

        return false; // King not actually present...
    }

    king_in_check(): boolean {
        // Don't call this if the king position is already
        // known since this method uses an expensive find().

        let kch = this.active === "w" ? "K" : "k";
        let king_loc = this.find(kch)[0];

        if (king_loc === undefined) {
            return false;
        }

        return this.attacked(king_loc, this.active);
    }

    los(x1: number, y1: number, x2: number, y2: number) {
        // Returns false if there is no "line of sight" between the 2 points.

        // Check the line is straight....

        if (Math.abs(x2 - x1) > 0 && Math.abs(y2 - y1) > 0) {
            if (Math.abs(x2 - x1) !== Math.abs(y2 - y1)) {
                return false;
            }
        }

        let step_x: -1 | 0 | 1 = 0;
        let step_y: -1 | 0 | 1 = 0;

        if (x1 === x2) step_x = 0;
        if (x1 < x2) step_x = 1;
        if (x1 > x2) step_x = -1;

        if (y1 === y2) step_y = 0;
        if (y1 < y2) step_y = 1;
        if (y1 > y2) step_y = -1;

        let x = x1;
        let y = y1;

        while (true) {
            x += step_x;
            y += step_y;

            if (x === x2 && y === y2) {
                return true;
            }

            if (this.state[x][y]) {
                return false;
            }
        }
    }

    attacked(target: Readonly<Point> | null, my_color: "w" | "b" | "") {
        if (!my_color) {
            throw "attacked(): no color given";
        }

        if (!target) {
            // Because it was null from Point(foo) perhaps.
            return false;
        }

        // Attacks along the lines...

        for (let step_x = -1; step_x <= 1; step_x++) {
            for (let step_y = -1; step_y <= 1; step_y++) {
                if (step_x === 0 && step_y === 0) continue;

                if (this.line_attack(target, step_x as -1 | 0 | 1, step_y as -1 | 0 | 1, my_color)) {
                    return true;
                }
            }
        }

        // Knights...

        for (let d of [
            [-2, -1],
            [-2, 1],
            [-1, -2],
            [-1, 2],
            [1, -2],
            [1, 2],
            [2, -1],
            [2, 1]
        ]) {
            let x = target.x + d[0];
            let y = target.y + d[1];

            if (x < 0 || x > 7 || y < 0 || y > 7) continue;

            if (["N", "n"].includes(this.state[x][y])) {
                if (this.color(point_from_xy(x, y)) === my_color) continue;
                return true;
            }
        }

        return false;
    }

    line_attack(target: Readonly<Point>, step_x: -1 | 0 | 1, step_y: -1 | 0 | 1, my_color: "w" | "b"): boolean {
        // Is the target square under attack via the line specified by step_x and step_y (which are both -1, 0, or 1) ?

        if (!my_color) {
            throw "line_attack(): no color given";
        }

        if (!target) {
            // Because it was null from Point(foo) perhaps.
            return false;
        }

        if (step_x === 0 && step_y === 0) {
            return false;
        }

        let x = target.x;
        let y = target.y;

        let ranged_attackers = ["Q", "q", "R", "r"]; // Ranged attackers that can go in a cardinal direction.
        if (step_x !== 0 && step_y !== 0) {
            ranged_attackers = ["Q", "q", "B", "b"]; // Ranged attackers that can go in a diagonal direction.
        }

        let iteration = 0;

        while (true) {
            iteration++;

            x += step_x;
            y += step_y;

            if (x < 0 || x > 7 || y < 0 || y > 7) {
                return false;
            }

            if (this.state[x][y] === "") {
                continue;
            }

            // So there's something here. Must return now.

            if (this.color(point_from_xy(x, y)) === my_color) {
                return false;
            }

            // We now know the piece is hostile. This allows us to mostly not care
            // about distinctions between "Q" and "q", "R" and "r", etc.

            // Is it one of the ranged attacker types?

            if (ranged_attackers.includes(this.state[x][y])) {
                return true;
            }

            // Pawns and kings are special cases (attacking iff it's the first iteration)

            if (iteration === 1) {
                if (["K", "k"].includes(this.state[x][y])) {
                    return true;
                }

                if (Math.abs(step_x) === 1) {
                    if (this.state[x][y] === "p" && step_y === -1) {
                        // Black pawn in attacking position
                        return true;
                    }

                    if (this.state[x][y] === "P" && step_y === 1) {
                        // White pawn in attacking position
                        return true;
                    }
                }
            }

            return false;
        }
    }

    find(piece: string, startx?: number, starty?: number, endx?: number, endy?: number) {
        // Find all pieces of the specified type (color-specific).
        // Search range is INCLUSIVE. Result returned as a list of points.
        // You can call this function with just a piece to search the whole board.

        if (startx === undefined) startx = 0;
        if (starty === undefined) starty = 0;
        if (endx === undefined) endx = 7;
        if (endy === undefined) endy = 7;

        // Calling with out of bounds args should also work...

        if (startx < 0) startx = 0;
        if (startx > 7) startx = 7;
        if (starty < 0) starty = 0;
        if (starty > 7) starty = 7;
        if (endx < 0) endx = 0;
        if (endx > 7) endx = 7;
        if (endy < 0) endy = 0;
        if (endy > 7) endy = 7;

        let ret: Readonly<Point>[] = [];

        for (let x = startx; x <= endx; x++) {
            for (let y = starty; y <= endy; y++) {
                if (this.state[x][y] === piece) {
                    ret.push(assert_point(point_from_xy(x, y)));
                }
            }
        }

        return ret;
    }

    find_castling_move(long_flag: boolean) {
        // Returns a (possibly illegal) castling move (e.g. "e1h1") or ""

        let king_loc: Readonly<Point>;

        if (this.active === "w") {
            king_loc = this.find("K", 0, 7, 7, 7)[0];
        } else {
            king_loc = this.find("k", 0, 0, 7, 0)[0];
        }

        if (king_loc === undefined) {
            return "";
        }

        let possible_rights_chars: string[];

        if (this.active === "w") {
            possible_rights_chars = ["A", "B", "C", "D", "E", "F", "G", "H"];
        } else {
            possible_rights_chars = ["a", "b", "c", "d", "e", "f", "g", "h"];
        }

        if (long_flag) {
            possible_rights_chars = possible_rights_chars.slice(0, king_loc.x);
            possible_rights_chars.reverse(); // So we propose the shortest move first, if more than 1 is allowed by the rights.
        } else {
            possible_rights_chars = possible_rights_chars.slice(king_loc.x + 1);
        }

        for (let ch of possible_rights_chars) {
            if (this.castling.includes(ch)) {
                if (this.active === "w") {
                    return king_loc.s + ch.toLowerCase() + "1";
                } else {
                    return king_loc.s + ch + "8";
                }
            }
        }

        return "";
    }

    parse_pgn(s: string): [move: string, error: string] {
        // Returns a UCI move and an error message.

        // Replace fruity dash characters with proper ASCII dash "-"

        for (let n of [8208, 8210, 8211, 8212, 8213, 8722]) {
            s = replace_all(s, String.fromCodePoint(n), "-");
        }

        // If the string contains any dots it'll be something like "1.e4" or "...e4" or whatnot...

        let lio = s.lastIndexOf(".");
        if (lio !== -1) {
            s = s.slice(lio + 1);
        }

        // At this point, if s is actually a UCI string (which it won't be in real PGN) we can return it.
        // This is a hack to allow pasting of stuff from non-PGN sources I guess...

        if (s.length === 4 || (s.length === 5 && ["q", "r", "b", "n"].includes(s[4]))) {
            if (s[0] >= "a" && s[0] <= "h" && s[1] >= "1" && s[1] <= "8" && s[2] >= "a" && s[2] <= "h" && s[3] >= "1" && s[3] <= "8") {
                let tmp = this.c960_castling_converter(s);
                if (!this.illegal(tmp)) {
                    return [tmp, ""];
                }
            }
        }

        // Delete things we don't need...

        s = replace_all(s, "x", "");
        s = replace_all(s, "+", "");
        s = replace_all(s, "#", "");
        s = replace_all(s, "!", "");
        s = replace_all(s, "?", "");

        // Fix castling with zeroes...

        s = replace_all(s, "0-0-0", "O-O-O");
        s = replace_all(s, "0-0", "O-O");

        if (s.toUpperCase() === "O-O") {
            let mv = this.find_castling_move(false);

            if (mv && !this.illegal(mv)) {
                return [mv, ""];
            } else {
                return ["", "illegal castling"];
            }
        }

        if (s.toUpperCase() === "O-O-O") {
            let mv = this.find_castling_move(true);

            if (mv && !this.illegal(mv)) {
                return [mv, ""];
            } else {
                return ["", "illegal castling"];
            }
        }

        // Just in case, delete any "-" characters (after handling castling, of course)...

        s = replace_all(s, "-", "");

        // If an = sign is present, save promotion string, then delete it from s...

        let promotion = "";

        if (s[s.length - 2] === "=") {
            promotion = s[s.length - 1].toLowerCase();
            s = s.slice(0, -2);
        }

        // A lax writer might also write the promotion string without an equals sign...

        if (promotion === "") {
            if (["Q", "R", "B", "N", "q", "r", "b", "n"].includes(s[s.length - 1])) {
                promotion = s[s.length - 1].toLowerCase();
                s = s.slice(0, -1);
            }
        }

        // If the piece isn't specified (with an uppercase letter) then it's a pawn move.
        // Let's add P to the start of the string to keep the string format consistent...

        if (["K", "Q", "R", "B", "N", "P"].includes(s[0]) === false) {
            s = "P" + s;
        }

        // Now this works...

        let piece = s[0];

        // We care about the color of the piece, so make black pieces lowercase...

        if (this.active === "b") {
            piece = piece.toLowerCase();
        }

        // The last 2 characters specify the target point. We've removed all trailing
        // garbage that could interfere with this fact.

        let dest = point_from_s(s.slice(s.length - 2, s.length));
        if (!dest) {
            return ["", "invalid destination"];
        }

        // Any characters between the piece and target should be disambiguators...

        let disambig = s.slice(1, -2);

        let startx = 0;
        let endx = 7;

        let starty = 0;
        let endy = 7;

        for (let c of disambig) {
            if (c >= "a" && c <= "h") {
                startx = c.charCodeAt(0) - 97;
                endx = startx;
            }
            if (c >= "1" && c <= "8") {
                starty = 7 - (c.charCodeAt(0) - 49);
                endy = starty;
            }
        }

        // If it's a pawn and hasn't been disambiguated then it is moving forwards...

        if (piece === "P" || piece === "p") {
            if (disambig.length === 0) {
                startx = dest.x;
                endx = dest.x;
            }
        }

        let sources = this.find(piece, startx, starty, endx, endy);

        if (sources.length === 0) {
            return ["", "piece not found"];
        }

        let possible_moves: string[] = [];

        for (let source of sources) {
            possible_moves.push(source.s + dest.s + promotion);
        }

        let valid_moves: string[] = [];

        for (let move of possible_moves) {
            if (this.illegal(move) === "") {
                valid_moves.push(move);
            }
        }

        if (valid_moves.length === 1) {
            return [valid_moves[0], ""];
        }

        if (valid_moves.length === 0) {
            return ["", "piece found but move illegal"];
        }

        if (valid_moves.length > 1) {
            return ["", `ambiguous moves: [${valid_moves}]`];
        }

        throw new Error();
    }

    piece(point: Readonly<Point> | null): string {
        if (point) {
            return this.state[point.x][point.y];
        } else {
            return "";
        }
    }

    is_white(point: Readonly<Point> | null): boolean {
        let piece = this.piece(point);
        return ["K", "Q", "R", "B", "N", "P"].includes(piece); // Can't do "KQRBNP".includes() as that catches "".
    }

    is_black(point: Readonly<Point> | null): boolean {
        let piece = this.piece(point);
        return ["k", "q", "r", "b", "n", "p"].includes(piece); // Can't do "kqrbnp".includes() as that catches "".
    }

    is_empty(point: Readonly<Point> | null): boolean {
        return this.piece(point) === "";
    }

    color(point: Readonly<Point> | null): "w" | "b" | "" {
        let piece = this.piece(point);
        if (piece === "") {
            return "";
        }
        if (["K", "Q", "R", "B", "N", "P"].includes(piece)) {
            return "w";
        }
        return "b";
    }

    same_color(point1: Readonly<Point> | null, point2: Readonly<Point> | null) {
        return this.color(point1) === this.color(point2);
    }

    /**
     * Generates the permissable moves in long algebraic notation.
     * @param one_only
     * @returns
     */
    movegen(one_only = false): string[] {
        const moves: string[] = [];

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                let source = assert_point(point_from_xy(x, y));

                if (this.color(source) !== this.active) {
                    continue;
                }

                let piece = this.state[x][y];

                if (piece !== "K" && piece !== "k") {
                    // We don't include kings because castling is troublesome.

                    for (let slider of movegen_sliders[piece]) {
                        // The sliders are lists where, if one move is blocked, every subsequent move in the slider is also
                        // blocked. Note that the test is "blocked / offboard". The test is not "is illegal" - sometimes one
                        // move will be illegal but a move further down the slider will be legal - e.g. if it blocks a check.

                        for (let [dx, dy] of slider) {
                            let x2 = x + dx;
                            let y2 = y + dy;

                            if (x2 < 0 || x2 > 7 || y2 < 0 || y2 > 7) {
                                // No move further along the slider will be legal.
                                break;
                            }

                            let dest = point_from_xy(x2, y2);
                            let dest_color = this.color(dest);

                            if (dest_color === this.active) {
                                // No move further along the slider will be legal.
                                break;
                            }

                            let move = source.s + assert_point(dest).s;

                            if ((piece === "P" && assert_point(dest).y === 0) || (piece === "p" && assert_point(dest).y === 7)) {
                                if (this.illegal(move + "q") === "") {
                                    moves.push(move + "q");
                                    if (one_only) {
                                        return moves;
                                    }
                                    moves.push(move + "r");
                                    moves.push(move + "b");
                                    moves.push(move + "n");
                                }
                            } else {
                                if (this.illegal(move) === "") {
                                    moves.push(move);
                                    if (one_only) {
                                        return moves;
                                    }
                                }
                            }

                            if (dest_color !== "") {
                                // No move further along the slider will be legal.
                                break;
                            }
                        }
                    }
                } else {
                    // King moves that involve vertical direction...

                    for (let dx of [-1, 0, 1]) {
                        for (let dy of [-1, 1]) {
                            let x2 = x + dx;
                            let y2 = y + dy;
                            if (x2 < 0 || x2 > 7 || y2 < 0 || y2 > 7) {
                                continue;
                            }
                            let dest = assert_point(point_from_xy(x2, y2));
                            let move = source.s + dest.s;
                            if (this.illegal(move) === "") {
                                moves.push(move);
                                if (one_only) {
                                    return moves;
                                }
                            }
                        }
                    }

                    // Horizontal king moves (including castling moves)...

                    for (let x2 = 0; x2 < 8; x2++) {
                        let dest = point_from_xy(x2, y);
                        let move = source.s + assert_point(dest).s;
                        if (this.illegal(move) === "") {
                            moves.push(move);
                            if (one_only) {
                                return moves;
                            }
                        }
                    }
                }
            }
        }

        return moves;
    }

    nice_movegen() {
        return this.movegen().map((s) => this.nice_string(s));
    }

    no_moves(): boolean {
        return this.movegen(true).length === 0;
    }

    c960_castling_converter(s: string): string {
        // Given some move s, convert it to the new Chess 960 castling format if needed.

        if (s === "e1g1" && this.state[4][7] === "K" && this.castling.includes("G") === false) return "e1h1";
        if (s === "e1c1" && this.state[4][7] === "K" && this.castling.includes("C") === false) return "e1a1";
        if (s === "e8g8" && this.state[4][0] === "k" && this.castling.includes("g") === false) return "e8h8";
        if (s === "e8c8" && this.state[4][0] === "k" && this.castling.includes("c") === false) return "e8a8";
        return s;
    }

    nice_string(s: string): string {
        // Given some raw (but valid) UCI move string, return a nice human-readable
        // string for display in the browser window. This string should never be
        // examined by the caller, merely displayed.
        //
        // Note that as of 1.1.6, all castling moves are expected to be king-onto-rook,
        // that is, Chess960 format.

        // s = this.c960_castling_converter(s);		// Too many ramifications to think about.

        let source = point_from_s(s.slice(0, 2));
        let dest = point_from_s(s.slice(2, 4));

        if (!source || !dest) {
            return "??";
        }

        let piece = this.piece(source);

        if (piece === "") {
            return "??";
        }

        let check = "";
        let next_board = this.move(s);
        let opponent_king_char = this.active === "w" ? "k" : "K";
        let opponent_king_square = this.find(opponent_king_char)[0]; // Might be undefined on corrupt board...

        if (opponent_king_square && next_board.attacked(opponent_king_square, next_board.color(opponent_king_square))) {
            if (next_board.no_moves()) {
                check = "#";
            } else {
                check = "+";
            }
        }

        if (["K", "k", "Q", "q", "R", "r", "B", "b", "N", "n"].includes(piece)) {
            if (["K", "k"].includes(piece)) {
                if (this.color(dest) === this.color(source)) {
                    if (dest.x > source.x) {
                        return `O-O${check}`;
                    } else {
                        return `O-O-O${check}`;
                    }
                }
            }

            // Would the move be ambiguous?
            // IMPORTANT: note that the actual move will not necessarily be valid_moves[0].

            let possible_sources = this.find(piece);
            let possible_moves: string[] = [];
            let valid_moves: string[] = [];

            for (let foo of possible_sources) {
                possible_moves.push(foo.s + dest.s); // e.g. "g1f3" - note we are only dealing with pieces, so no worries about promotion
            }

            for (let move of possible_moves) {
                if (this.illegal(move) === "") {
                    valid_moves.push(move);
                }
            }

            if (valid_moves.length > 2) {
                // Full disambiguation.

                if (this.piece(dest) === "") {
                    return piece.toUpperCase() + source.s + dest.s + check;
                } else {
                    return piece.toUpperCase() + source.s + "x" + dest.s + check;
                }
            }

            if (valid_moves.length === 2) {
                // Partial disambiguation.

                let source1 = assert_point(point_from_s(valid_moves[0].slice(0, 2)));
                let source2 = assert_point(point_from_s(valid_moves[1].slice(0, 2)));

                let disambiguator;

                if (source1.x === source2.x) {
                    disambiguator = source.s[1]; // Note source (the true source), not source1
                } else {
                    disambiguator = source.s[0]; // Note source (the true source), not source1
                }

                if (this.piece(dest) === "") {
                    return piece.toUpperCase() + disambiguator + dest.s + check;
                } else {
                    return piece.toUpperCase() + disambiguator + "x" + dest.s + check;
                }
            }

            // No disambiguation.

            if (this.piece(dest) === "") {
                return piece.toUpperCase() + dest.s + check;
            } else {
                return piece.toUpperCase() + "x" + dest.s + check;
            }
        }

        // So it's a pawn. Pawn moves are never ambiguous.

        let ret;

        if (source.x === dest.x) {
            ret = dest.s;
        } else {
            ret = source.s[0] + "x" + dest.s;
        }

        if (s.length > 4) {
            ret += "=";
            ret += s[4].toUpperCase();
        }

        ret += check;

        return ret;
    }

    next_number_string() {
        if (this.active === "w") {
            return `${this.fullmove}.`;
        } else {
            return `${this.fullmove}...`;
        }
    }
    /**
     *
     * @param friendly_flag for when the engine isn't the consumer.
     * @param book_flag  for when we should omit the move numbers.
     * @returns
     */
    fen(friendly_flag?: boolean, book_flag?: boolean) {
        // friendly_flag - for when the engine isn't the consumer.
        // book_flag - for when we should omit the move numbers.

        let s = "";

        for (let y = 0; y < 8; y++) {
            let x = 0;
            let blanks = 0;

            while (true) {
                if (this.state[x][y] === "") {
                    blanks++;
                } else {
                    if (blanks > 0) {
                        s += blanks.toString();
                        blanks = 0;
                    }
                    s += this.state[x][y];
                }

                x++;

                if (x >= 8) {
                    if (blanks > 0) {
                        s += blanks.toString();
                    }
                    if (y < 7) {
                        s += "/";
                    }
                    break;
                }
            }
        }

        let ep_string = this.enpassant ? this.enpassant.s : "-";
        let castling_string = this.castling !== "" ? this.castling : "-";

        // While internally we always use Chess960 format, we can return a more friendly
        // FEN if asked (and if the position is normal Chess). Relies on our normalchess
        // flag being accurate... (potential for bugs there).

        if (friendly_flag && this.normalchess && castling_string !== "-") {
            let new_castling_string = "";
            if (castling_string.includes("H")) new_castling_string += "K";
            if (castling_string.includes("A")) new_castling_string += "Q";
            if (castling_string.includes("h")) new_castling_string += "k";
            if (castling_string.includes("a")) new_castling_string += "q";
            castling_string = new_castling_string;
        }

        if (book_flag) {
            return s + ` ${this.active} ${castling_string} ${ep_string}`;
        } else {
            return s + ` ${this.active} ${castling_string} ${ep_string} ${this.halfmove} ${this.fullmove}`;
        }
    }

    insufficient_material(): boolean {
        // There are some subtleties around help-mates and also positions where
        // mate is forced despite there not being enough material if the pieces
        // were elsewhere. This code below should have no false positives...

        let minors = 0;

        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                switch (this.state[x][y]) {
                    case "Q":
                    case "q":
                    case "R":
                    case "r":
                    case "P":
                    case "p":
                        return false;
                    case "B":
                    case "b":
                    case "N":
                    case "n":
                        minors++;
                        if (minors >= 2) {
                            return false;
                        }
                }
            }
        }

        return true;
    }

    graphic(): string {
        let units: string[] = [];
        for (let y = 0; y < 8; y++) {
            units.push("\n");
            for (let x = 0; x < 8; x++) {
                units.push(this.state[x][y] === "" ? "." : this.state[x][y]);
                if (x < 7) {
                    units.push(" ");
                }
            }
            if (y === 7) {
                units.push("  ");
                units.push(this.fen(false));
            }
        }
        units.push("\n");
        return units.join("");
    }

    compare(other: Position): boolean {
        if (this.active !== other.active) return false;
        if (this.castling !== other.castling) return false;
        if (this.enpassant !== other.enpassant) return false; // FIXME? Issues around fake e.p. squares.
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                if (this.state[x][y] !== other.state[x][y]) {
                    return false;
                }
            }
        }
        return true;
    }

    copy(): Position {
        return create_position(this.state, this.active, this.castling, this.enpassant, this.halfmove, this.fullmove, this.normalchess);
    }
}

export function create_position(state: string[][] | null = null, active: "w" | "b" = "w", castling = "", enpassant: Readonly<Point> | null = null, halfmove = 0, fullmove = 1, normalchess = false) {
    let p = new Position();

    p.state = [
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", ""]
    ];

    if (state) {
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                let piece = state[x][y];
                if (piece) {
                    p.state[x][y] = piece;
                }
            }
        }
    }

    p.active = active;
    p.castling = castling;
    p.enpassant = enpassant;
    p.halfmove = halfmove;
    p.fullmove = fullmove;
    p.normalchess = normalchess;

    return p;
}
