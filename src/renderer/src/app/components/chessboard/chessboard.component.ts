import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";
import { Chess, DEFAULT_POSITION } from "chess.js";
import "chessboard-element";
import { ChessBoardElement, fenToObj, objToFen, PositionObject } from "chessboard-element";
import { fromEvent, Observable } from "rxjs";

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
    constructor() {
        this.updateStatus();
    }

    async ngOnInit() {
        console.log("chessboard");
        await window.customElements.whenDefined("chess-board");
        // The idea here is to set up the board and observables once and them use them in different modes.
        this.board = document.getElementById("board") as ChessBoardElement;
        this.change$ = fromEvent<ChangeEvent>(this.board, "change");
        this.board.sparePieces = false;
        this.board.draggablePieces = true;
        this.change$.subscribe((event) => {
            console.log("change:");
            console.log("Old position: " + objToFen(event.detail.oldValue));
            console.log("New position: " + objToFen(event.detail.value));
        });
        this.dragStart$ = fromEvent<DragStartEvent>(this.board, "drag-start");
        this.dragStart$.subscribe((event) => {
            const { source, piece, position, orientation } = event.detail;
            console.log("drag-start:");
            console.log("Source: " + source);
            console.log("Piece: " + piece);
            console.log("Position: " + objToFen(position));
            console.log("Orientation: " + orientation);
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
        });
        fromEvent<DragMoveEvent>(this.board, "drag-move").subscribe((event) => {
            const { newLocation, oldLocation, source, piece, position, orientation } = event.detail;
            console.log("New location: " + newLocation);
            console.log("Old location: " + oldLocation);
            console.log("Source: " + source);
            console.log("Piece: " + piece);
            console.log("Position: " + objToFen(position));
            console.log("Orientation: " + orientation);
        });
        fromEvent<DropEvent>(this.board, "drop").subscribe((event) => {
            const { source, target, piece, newPosition, oldPosition, orientation, setAction } = event.detail;
            console.log("Source: " + source);
            console.log("Target: " + target);
            console.log("Piece: " + piece);
            console.log("New position: " + objToFen(newPosition));
            console.log("Old position: " + objToFen(oldPosition));
            console.log("Orientation: " + orientation);
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
                console.log(`Illegal move: ${e}`);
                setAction("snapback");
            }

            this.updateStatus();
            /*
            if (piece.search(/b/) !== -1) {
                setAction("trash");
            }
            */
        });
        fromEvent<SnapbackEndEvent>(this.board, "snap-end").subscribe((event) => {
            console.log("snap-end:");
            const { piece, square, position, orientation } = event.detail;

            console.log("Piece: " + piece);
            console.log("Square: " + square);
            console.log("Position: " + objToFen(position));
            console.log("Orientation: " + orientation);
            // update the board position after the piece snap
            // for castling, en passant, pawn promotion
            this.board.setPosition(this.game.fen());
        });
        fromEvent<SnapbackEndEvent>(this.board, "snapback-end").subscribe((event) => {
            console.log("snapback-end:");
            const { piece, square, position, orientation } = event.detail;

            console.log("Piece: " + piece);
            console.log("Square: " + square);
            console.log("Position: " + objToFen(position));
            console.log("Orientation: " + orientation);
            // this.board.setPosition(this.game.fen());
        });
        fromEvent<MoveEndEvent>(this.board, "move-end").subscribe((event) => {
            console.log("move-end:");
            console.log("Old position: " + objToFen(event.detail.oldPosition));
            console.log("New position: " + objToFen(event.detail.newPosition));
        });
    }

    async flip(): Promise<void> {
        await window.customElements.whenDefined("chess-board");
        const board = document.getElementById("board") as ChessBoardElement;
        console.log("chess-board is defined");
        board.flip();
    }
    async clear(): Promise<void> {
        await window.customElements.whenDefined("chess-board");
        const board = document.getElementById("board") as ChessBoardElement;
        console.log("chess-board is defined");
        this.board.clear();
        this.game.clear();
        this.updateStatus();
    }
    async reset(): Promise<void> {
        const position = fenToObj("");
        this.board.setPosition("start", true);
        this.game.load(DEFAULT_POSITION);
        this.board.hideNotation = false;
        this.updateStatus();
        console.log(this.board.fen());
    }
    updateStatus() {
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
