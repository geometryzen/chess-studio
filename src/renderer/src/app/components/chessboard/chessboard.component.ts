import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";
import "chessboard-element";
import { ChessBoardElement, PositionObject } from "chessboard-element";
import { fromEvent, Observable } from "rxjs";
import { FoobarService } from "src/app/foobar.service";
// Usage of chess.js is temporary until using our own tree-based implementation.
// The goal will be to achieve at least parity of functionality.
// This should be proved using tests.
import { Chess } from "../../../libs/chess";

interface ChangeEvent extends Event {
    detail: {
        value: PositionObject;
        oldValue: PositionObject;
    };
}

interface DragStartEvent extends Event {
    detail: {
        /**
         * The starting square.
         */
        source: string;
        /**
         *
         */
        piece: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

interface DragMoveEvent extends Event {
    detail: {
        /**
         *
         */
        source: string;
        /**
         *
         */
        piece: string;
        newLocation: string;
        oldLocation: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

interface DropEvent extends Event {
    detail: {
        /**
         *
         */
        source: string;
        target: string;
        /**
         *
         */
        piece: string;
        newPosition: PositionObject;
        oldPosition: PositionObject;
        orientation: "white" | "black";
        setAction: (action: "snapback" | "trash") => void;
    };
}

interface SnapbackEndEvent extends Event {
    detail: {
        piece: string;
        square: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

interface MoveEndEvent extends Event {
    detail: {
        oldPosition: PositionObject;
        newPosition: PositionObject;
    };
}

@Component({
    selector: "app-chessboard",
    templateUrl: "./chessboard.component.html",
    styleUrls: ["./chessboard.component.scss"],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    standalone: true
})
export class ChessboardComponent implements OnInit {
    // @ViewChild('board') board: ComponentRef<ChessBoardElement>;
    readonly game = new Chess();
    board!: ChessBoardElement;
    change$!: Observable<ChangeEvent>;
    dragStart$!: Observable<DragStartEvent>;
    status: string = "";
    fen: string = "";
    pgn: string = "";
    useAnimation: boolean = true;
    is_setup_mode: boolean = false;
    constructor(private controller: FoobarService) {
        this.updateStatus();
    }

    async ngOnInit() {
        // console.lg("chessboard");
        await window.customElements.whenDefined("chess-board");
        // The idea here is to set up the board and observables once and them use them in different modes.
        this.board = document.getElementById("board") as ChessBoardElement;
        this.change$ = fromEvent<ChangeEvent>(this.board, "change");
        this.board.sparePieces = false;
        this.board.draggablePieces = true;
        this.change$.subscribe((event) => {
            // console.lg("change:");
            // console.lg("Old position: " + objToFen(event.detail.oldValue));
            // console.lg("New position: " + objToFen(event.detail.value));
        });
        this.dragStart$ = fromEvent<DragStartEvent>(this.board, "drag-start");
        this.dragStart$.subscribe((event) => {
            const { source, piece, position, orientation } = event.detail;
            // console.lg("drag-start:");
            // console.lg("Source: " + source);
            // console.lg("Piece: " + piece);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
            if (this.is_setup_mode) {
                // We can start to move the pieces.
            } else {
                /*
                if ((orientation === 'white' && piece.search(/^w/) === -1) ||
                    (orientation === 'black' && piece.search(/^b/) === -1)) {
                    event.preventDefault();
                }
                */
                // do not pick up pieces if the game is over
                if (this.game.isGameOver()) {
                    event.preventDefault();
                    return;
                }

                // only pick up pieces for the side to move
                if ((this.game.turn() === "w" && piece.search(/^b/) !== -1) || (this.game.turn() === "b" && piece.search(/^w/) !== -1)) {
                    event.preventDefault();
                    return;
                }
            }
        });
        fromEvent<DragMoveEvent>(this.board, "drag-move").subscribe((event) => {
            const { newLocation, oldLocation, source, piece, position, orientation } = event.detail;
            // console.lg("New location: " + newLocation);
            // console.lg("Old location: " + oldLocation);
            // console.lg("Source: " + source);
            // console.lg("Piece: " + piece);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
        });
        fromEvent<DropEvent>(this.board, "drop").subscribe((event) => {
            const { source, target, piece, newPosition, oldPosition, orientation, setAction } = event.detail;
            // console.lg("Source: " + source);
            // console.lg("Target: " + target);
            // console.lg("Piece: " + piece);
            // console.lg("New position: " + objToFen(newPosition));
            // console.lg("Old position: " + objToFen(oldPosition));
            // console.lg("Orientation: " + orientation);
            if (this.is_setup_mode) {
            } else {
                // see if the move is legal
                try {
                    const move = this.game.move({
                        from: source,
                        to: target,
                        promotion: "q" // NOTE: always promote to a queen for example simplicity
                    });
                    // illegal move
                    if (move === null) {
                        setAction("snapback");
                    }
                } catch (e) {
                    // console.lg(`Illegal move: ${e}`);
                    setAction("snapback");
                }
                this.updateStatus();
            }
            /*
            if (piece.search(/b/) !== -1) {
                setAction("trash");
            }
            */
        });
        fromEvent<SnapbackEndEvent>(this.board, "snap-end").subscribe((event) => {
            // console.lg("snap-end:");
            const { piece, square, position, orientation } = event.detail;

            // console.lg("Piece: " + piece);
            // console.lg("Square: " + square);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
            if (this.is_setup_mode) {
            } else {
                // update the board position after the piece snap
                // for castling, en passant, pawn promotion
                this.board.setPosition(this.game.fen());
            }
        });
        fromEvent<SnapbackEndEvent>(this.board, "snapback-end").subscribe((event) => {
            // console.lg("snapback-end:");
            const { piece, square, position, orientation } = event.detail;

            // console.lg("Piece: " + piece);
            // console.lg("Square: " + square);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
            // this.board.setPosition(this.game.fen());
        });
        fromEvent<MoveEndEvent>(this.board, "move-end").subscribe((event) => {
            // console.lg("move-end:");
            // console.lg("Old position: " + objToFen(event.detail.oldPosition));
            // console.lg("New position: " + objToFen(event.detail.newPosition));
        });
        this.controller.onNewGameClassic(() => {
            this.game.reset();
            this.board.setPosition(this.game.fen(), this.useAnimation);
            this.exitSetupMode();
        });
        this.controller.onGameClear(() => {
            this.game.clear();
            this.board.clear(this.useAnimation);
            this.enterSetupMode();
        });
        this.controller.onGameSetup(() => {
            this.enterSetupMode();
        });
        this.controller.onGamePlay(() => {
            this.exitSetupMode();
        });
        this.controller.onBoardFlip(() => {
            this.board.flip();
        });
    }
    enterSetupMode() {
        this.is_setup_mode = true;
        this.board.sparePieces = true;
        this.board.dropOffBoard = "trash";
        this.updateStatus();
    }
    exitSetupMode() {
        this.board.sparePieces = false;
        this.board.dropOffBoard = "snapback";
        this.is_setup_mode = false;
        try {
            const fen = `${this.board.fen()} w KQkq - 0 1`;
            // console.lg("fen", fen);
            if (fen) {
                // The
                this.game.load(fen);
            }
            this.updateStatus();
        } catch (e) {
            const cause = e instanceof Error ? e.message : `${e}`;
            this.status = `Something is rotten in Denmark. Cause: ${cause}`;
        }
    }
    updateStatus() {
        if (this.is_setup_mode) {
            this.status = "Setting up Board";
        } else {
            let status = "";

            let moveColor = "White";
            if (this.game.turn() === "b") {
                moveColor = "Black";
            }

            if (this.game.isCheckmate()) {
                // checkmate?
                status = `Game over, ${moveColor} is in checkmate.`;
            } else if (this.game.isDraw()) {
                // draw?
                status = "Game over, drawn position";
            } else {
                // game still on
                status = `${moveColor} to move`;

                // check?
                if (this.game.isCheck()) {
                    status += `, ${moveColor} is in check`;
                }
            }

            this.status = status;
            this.fen = this.game.fen();
            this.pgn = this.game.pgn();
        }
    }
}
