import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit } from "@angular/core";
import "chessboard-element";
import { ChessBoardElement, PositionObject } from "chessboard-element";
import { fromEvent, Observable } from "rxjs";
import { BestMove, FoobarService, MoveScore } from "src/app/foobar.service";
import { Node } from "src/libs/Node";
import { point_from_s, Square } from "src/libs/Position";
import { sorted_primary_variations } from "src/libs/PositionInfo";
import { Tree } from "src/libs/Tree";

interface LegalMove {
    from: Square;
    to: Square;
}

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
export class ChessboardComponent implements OnInit, OnDestroy {
    readonly tree = new Tree();
    boardUI!: ChessBoardElement;
    /**
     * The node that the Chess engine is currently analyzing.
     * This is used to ensure that the engine analysis is applied to the correct node,
     * and to ensure that the engine is analyzing the current node.
     */
    engineNode: Node | null = null;
    change$!: Observable<ChangeEvent>;
    dragStart$!: Observable<DragStartEvent>;
    status: string = "";
    fen: string = "";
    pgn: string = "";
    useAnimation: boolean = false;
    is_setup_mode: boolean = false;
    in_960_mode: boolean = false;
    constructor(private controller: FoobarService) {
        this.updateStatus();
    }

    async ngOnInit() {
        // console.lg("chessboard");
        await window.customElements.whenDefined("chess-board");
        // The idea here is to set up the board and observables once and them use them in different modes.
        this.boardUI = document.getElementById("board") as ChessBoardElement;
        this.change$ = fromEvent<ChangeEvent>(this.boardUI, "change");
        this.boardUI.sparePieces = false;
        this.boardUI.draggablePieces = true;
        this.change$.subscribe((event) => {
            // console.lg("change:");
            // console.lg("Old position: " + objToFen(event.detail.oldValue));
            // console.lg("New position: " + objToFen(event.detail.value));
        });
        this.dragStart$ = fromEvent<DragStartEvent>(this.boardUI, "drag-start");
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
                if (this.tree.isGameOver()) {
                    event.preventDefault();
                    return;
                }

                // only pick up pieces for the side to move
                if ((this.tree.turn() === "w" && piece.search(/^b/) !== -1) || (this.tree.turn() === "b" && piece.search(/^w/) !== -1)) {
                    event.preventDefault();
                    return;
                }
            }
        });
        fromEvent<DragMoveEvent>(this.boardUI, "drag-move").subscribe((event) => {
            const { newLocation, oldLocation, source, piece, position, orientation } = event.detail;
            // console.lg("New location: " + newLocation);
            // console.lg("Old location: " + oldLocation);
            // console.lg("Source: " + source);
            // console.lg("Piece: " + piece);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
        });
        fromEvent<DropEvent>(this.boardUI, "drop").subscribe((event) => {
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
                    const move = this.move(`${source}${target}`);
                    /*
                    const ignore: Move = this.game.move({
                        from: source,
                        to: target,
                        promotion: "q" // NOTE: always promote to a queen for example simplicity. What happens if not specified?
                    });
                    */
                    // illegal move
                    if (move === null) {
                        setAction("snapback");
                    } else {
                        // console.lg(`${JSON.stringify(move, null, 2)}`);
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
        fromEvent<SnapbackEndEvent>(this.boardUI, "snap-end").subscribe((event) => {
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
                this.boardUI.setPosition(this.tree.fen());
            }
        });
        fromEvent<SnapbackEndEvent>(this.boardUI, "snapback-end").subscribe((event) => {
            // console.lg("snapback-end:");
            const { piece, square, position, orientation } = event.detail;

            // console.lg("Piece: " + piece);
            // console.lg("Square: " + square);
            // console.lg("Position: " + objToFen(position));
            // console.lg("Orientation: " + orientation);
            // this.board.setPosition(this.game.fen());
        });
        fromEvent<MoveEndEvent>(this.boardUI, "move-end").subscribe((event) => {
            // console.lg("move-end:");
            // console.lg("Old position: " + objToFen(event.detail.oldPosition));
            // console.lg("New position: " + objToFen(event.detail.newPosition));
        });
        this.controller.onNewGameClassic(() => {
            this.tree.reset();
            this.boardUI.setPosition(this.tree.fen(), this.useAnimation);
            this.exitSetupMode();
        });
        this.controller.onGameClear(() => {
            this.tree.clear();
            this.boardUI.clear(this.useAnimation);
            this.enterSetupMode();
        });
        this.controller.onGameSetup(() => {
            this.enterSetupMode();
        });
        this.controller.onGamePlay(() => {
            this.exitSetupMode();
        });
        this.controller.onTreeRoot(() => {
            this.tree.goto_root();
        });
        this.controller.onTreeEnd(() => {
            this.tree.goto_end();
        });
        this.controller.onTreeBackward(() => {
            this.tree.prev();
        });
        this.controller.onTreeForward(() => {
            this.tree.next();
        });
        this.controller.onBoardFlip(() => {
            this.boardUI.flip();
        });
        this.tree.version$.subscribe(async () => {
            try {
                // console.lg(`version: ${this.tree.version$.getValue()}`);
                this.boardUI.setPosition(this.tree.fen());
                if (this.engineNode) {
                    // Any further events will be discarded.
                    this.engineNode = null;
                    // Wait for the engine to stop.
                    const stopinfo: BestMove = await this.controller.halt();
                    // TODO: We could apply this knowledge to the previous node...
                    stopinfo.bestmove
                    stopinfo.ponder;
                    for (const moveScore of stopinfo.info) {
                        moveScore.pv
                    }
                    // console.lg(`bestmove => ${JSON.stringify(stopinfo)}`);
                    // Restart analysis for the new position.
                    this.engineNode = this.tree.node;
                    const fen = this.engineNode.position.fen(true);
                    await this.controller.go(fen);
                }
                else {
                    // console.lg("There is no search in progress");
                }
            }
            catch (e) {
                console.log(`${e}`);
            }
        });
        this.controller.onAnalysisGo(async () => {
            this.engineNode = this.tree.node;
            const fen = this.engineNode.position.fen(true);
            await this.controller.go(fen);
        });
        this.controller.onAnalysisHalt(async () => {
            const retval: BestMove = await this.controller.halt();
            this.engineNode = null;
            // console.lg(`halt => ${JSON.stringify(retval)}`);
        });
        this.controller.onAnalysisMoveScore((moveScore: MoveScore) => {
            if (this.engineNode) {
                const moves: string[] = moveScore.pv.split(" ");
                if (moves.length > 0) {
                    const move = this.engineNode.position.c960_castling_converter(moves[0]);
                    // console.lg(`move => ${JSON.stringify(move)}`);
                    const posinfo = this.engineNode.position_info;
                    posinfo.nodes = moveScore.nodes;
                    posinfo.nps = moveScore.nps;
                    posinfo.tbhits = moveScore.tbhits;
                    posinfo.time = moveScore.time;

                    const moveinfo = posinfo.moveinfo[move];
                    moveinfo.depth = moveScore.depth;
                    moveinfo.multipv = moveScore.multipv;
                    moveinfo.pv = moves;
                    moveinfo.cp = moveScore.score.value;
                    moveinfo.seldepth = moveScore.seldepth;
                    // console.log(`moveinfo[${move}] => ${JSON.stringify(moveinfo)}`);
                }
                // Having just updated the position information, we can sort it to determine the best move ordering.
                const pvis = sorted_primary_variations(this.engineNode).map((pvi) => {
                    return { move: pvi.move, cp: pvi.cp, line: pvi.pv }
                });
                // console.lg(JSON.stringify(pvis, null, 2));
            }
        });

        // this.controller.onAnalysisMoveCandidate((moveCandidate: MoveCandidate) => {
        //     console.lg(`moveCandidate => ${JSON.stringify(moveCandidate)}`);
        // });
    }

    ngOnDestroy(): void {
        // console.lg("ChessboardComponent.onDestroy()");
    }

    enterSetupMode() {
        this.is_setup_mode = true;
        this.boardUI.sparePieces = true;
        this.boardUI.dropOffBoard = "trash";
        this.updateStatus();
    }
    exitSetupMode() {
        this.boardUI.sparePieces = false;
        this.boardUI.dropOffBoard = "snapback";
        this.is_setup_mode = false;
        try {
            const fen = `${this.boardUI.fen()} w KQkq - 0 1`;
            // console.lg("fen", fen);
            if (fen) {
                // The
                this.tree.load(fen);
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
            if (this.tree.turn() === "b") {
                moveColor = "Black";
            }

            if (this.tree.isCheckmate()) {
                // checkmate?
                status = `Game over, ${moveColor} is in checkmate.`;
            } else if (this.tree.isDraw()) {
                // draw?
                status = "Game over, drawn position";
            } else {
                // game still on
                status = `${moveColor} to move`;

                // check?
                if (this.tree.isCheck()) {
                    status += `, ${moveColor} is in check`;
                }
            }

            this.status = status;
            this.fen = this.tree.fen();
            this.pgn = this.tree.pgn();
        }
    }
    /**
     * It is safe to call this with illegal moves.
     * @param s is a string of the form {from}{to}[{promotion}], (algebraic) even for captures. promotion is optional.
     */
    move(s: string): LegalMove | null {
        // It is safe to call this with illegal moves.
        if (typeof s !== "string") {
            throw new Error();
        }

        const board = this.tree.node.position;
        const source = point_from_s(s.slice(0, 2));
        const target = point_from_s(s.slice(2, 4));
        const promotion = s.slice(4, 1);

        if (!source) {
            throw new Error("invalid source square");
        }

        if (!target) {
            throw new Error("invalid target square");
        }

        // First deal with old-school castling in Standard Chess...

        s = board.c960_castling_converter(s);

        // If a promotion character is required and not present, show the promotion chooser and return
        // without committing to anything.

        if (s.length === 4) {
            if ((board.piece(source) === "P" && source.y === 1) || (board.piece(source) === "p" && source.y === 6)) {
                const illegal_reason = board.illegal(s + "q");
                if (illegal_reason) {
                    // console.lg(`move(${s}) - ${illegal_reason}`);
                } else {
                    this.show_promotiontable(s);
                }
                return null;
            }
        }

        // The promised legality check...

        const illegal_reason = board.illegal(s);
        if (illegal_reason) {
            // console.lg(`move(${s}) - ${illegal_reason}`);
            return null;
        }

        this.tree.make_move(s);

        return { from: source.s, to: target.s };
    }

    show_promotiontable(partial_move: string) {
        /*
        let pieces = this.tree.node.board.active === "w" ? ["Q", "R", "B", "N"] : ["q", "r", "b", "n"];

        for (let piece of pieces) {
            let td = document.getElementsByClassName("promotion_" + piece.toLowerCase())[0];		// Our 4 TDs each have a unique class.
            td.id = "promotion_chooser_" + partial_move + piece.toLowerCase();						// We store the actual move in the id.
            td.width = config.square_size;
            td.height = config.square_size;
            td.style["background-image"] = images[piece].string_for_bg_style;
        }

        promotiontable.style.display = "block";
        */
    }
    hide_promotiontable() {
        /*
        promotiontable.style.display = "none";
        */
    }
}
