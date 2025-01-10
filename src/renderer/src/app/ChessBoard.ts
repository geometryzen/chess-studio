import { Board, Group, Path, Rectangle } from "@g20/core";
import { initBoard } from "@g20/svg";

type Coord = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const COORDS_X = [0, 1, 2, 3, 4, 5, 6, 7] as const;
type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

const LEFT = -240;
const TOP = LEFT;
const RIGHT = 240;
const BOTTOM = RIGHT;
const BOARD_SIZE = RIGHT - LEFT;
const SQUARE_SIZE = BOARD_SIZE / 8;

export class ChessPiece { }

export class ChessBoard {
    #board: Board;
    orientation: "white" | "black" = "white";
    readonly squares: { [name: string]: Rectangle } = {};
    readonly pieces: { [square: string]: ChessPiece } = {};
    constructor(elementOrId: string | HTMLElement) {
        this.#board = initBoard(elementOrId, { boundingBox: { left: LEFT, bottom: BOTTOM, right: RIGHT, top: TOP } });

        for (const x of COORDS_X) {
            for (const y of COORDS_X) {
                const u = x * SQUARE_SIZE - 3.5 * SQUARE_SIZE;
                const v = y * SQUARE_SIZE - 3.5 * SQUARE_SIZE;
                const name = this.squareName(x, y);
                const color = this.squareColor(x, y);
                const rgbColor = color === "white" ? "#f0d9b5" : "#b58863";
                const square = this.#board.rectangle({
                    width: SQUARE_SIZE,
                    height: SQUARE_SIZE,
                    fillColor: rgbColor,
                    strokeColor: rgbColor,
                    position: [u, v]
                });
                this.squares[name] = square;
            }
        }

        const pawn = new Group(this.#board)
        pawn.matrix
        const path = new Path(this.#board, [])
        pawn.add(path);
        this.#board.add(pawn);
    }
    file(x: Coord): File {
        return this.orientation === "white" ? FILES[x] : FILES[7 - x];
    }
    rank(y: Coord): Rank {
        return this.orientation === "white" ? RANKS[y] : RANKS[7 - y];
    }
    squareName(x: Coord, y: Coord): string {
        return `${this.file(x)}${this.rank(y)}`;
    }
    squareColor(x: Coord, y: Coord): "white" | "black" {
        return (x + y) % 2 > 0 ? "black" : "white";
    }
    dispose(): void {
        this.#board.dispose();
    }
}
