import { Component, CUSTOM_ELEMENTS_SCHEMA, OnDestroy, OnInit, ViewChild } from "@angular/core";
import "chessboard-element";
import { ChessBoardElement } from "chessboard-element";
import { fromEvent, Observable } from "rxjs";
import { BestMove, FoobarService, MoveScore } from "src/app/foobar.service";
import { Node } from "src/libs/Node";
import { point_from_s, Square } from "src/libs/Position";
import { sorted_primary_variations } from "src/libs/PositionInfo";
import { Tree } from "src/libs/Tree";
import { ChangeEvent, ChessBoard, DragMoveEvent, DragStartEvent, DropEvent, MouseoutSquareEvent, MouseoverSquareEvent, MoveEndEvent, SnapbackEndEvent, SnapEndEvent } from "./chessboard.component";
// import { Chess } from "chess.js";

interface LegalMove {
    from: Square;
    to: Square;
}

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    imports: [ChessBoard],
    standalone: true
})
export class AppComponent implements OnInit, OnDestroy {
    //     readonly game = new Chess();
    readonly tree = new Tree();
    @ViewChild(ChessBoard) boardA: ChessBoard | undefined;
    boardC: ChessBoardElement | null = null;
    /**
     * The node that the Chess engine is currently analyzing.
     * This is used to ensure that the engine analysis is applied to the correct node,
     * and to ensure that the engine is analyzing the current node.
     */
    engineNode: Node | null = null;
    change$!: Observable<ChangeEvent>;
    dragStart$!: Observable<DragStartEvent>;
    status: string = "";
    position: string = "";
    pgn: string = "";
    /**
     *
     */
    useAnimation: boolean = true;
    is_setup_mode: boolean = false;
    in_960_mode: boolean = false;
    orientation: "white" | "black" = "white";
    constructor(private controller: FoobarService) {
        this.updateStatus();
    }

    async ngOnInit() {
        // console.lg("chessboard");
        await window.customElements.whenDefined("chess-board");
        // The idea here is to set up the board and observables once and them use them in different modes.
        this.boardC = document.getElementById("board-ui") as ChessBoardElement | null;
        if (this.boardC) {
            this.change$ = fromEvent<ChangeEvent>(this.boardC, "change");
            this.boardC.sparePieces = false;
            this.boardC.draggablePieces = true;

            this.change$.subscribe((event) => {
                this.onChange(event);
            });
            this.dragStart$ = fromEvent<DragStartEvent>(this.boardC, "drag-start");
            this.dragStart$.subscribe((event) => {
                this.onDragStart(event);
            });
            fromEvent<DragMoveEvent>(this.boardC, "drag-move").subscribe((event) => {
                this.onDragMove(event);
            });
            fromEvent<DropEvent>(this.boardC, "drop").subscribe((event) => {
                this.onDropEvent(event);
            });
            fromEvent<SnapEndEvent>(this.boardC, "snap-end").subscribe((event) => {
                this.onSnapEndEvent(event);
            });
            fromEvent<SnapbackEndEvent>(this.boardC, "snapback-end").subscribe((event) => {
                this.onSnapbackEndEvent(event);
            });
            fromEvent<MoveEndEvent>(this.boardC, "move-end").subscribe((event) => {
                this.onMoveEndEvent(event);
            });
        }
        this.controller.gameNew$.subscribe(() => {
            this.tree.reset();
            this.position = this.tree.fen();
            if (this.boardA) {
                this.boardA.setPosition(this.position, this.useAnimation);
            }
            if (this.boardC) {
                this.boardC.setPosition(this.position, this.useAnimation);
            }
            this.exitSetupMode();
        });
        this.controller.gameClear$.subscribe(() => {
            this.tree.clear();
            this.position = this.tree.fen();
            if (this.boardA) {
                this.boardA.clear(this.useAnimation);
            }
            if (this.boardC) {
                this.boardC.clear(this.useAnimation);
            }
            this.enterSetupMode();
        });
        /*
        this.controller.onGameClear(() => {
            this.tree.clear();
            this.position = this.tree.fen();
            if (this.boardA) {
                this.boardA.clear(this.useAnimation);
            }
            if (this.boardB) {
                this.boardB.clear(this.useAnimation);
            }
            this.enterSetupMode();
        });
        */
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
        this.controller.treeBackward$.subscribe(() => {
            this.tree.prev();
        });
        /*
        this.controller.onTreeBackward(() => {
            this.tree.prev();
        });
        */
        this.controller.onTreeForward(() => {
            this.tree.next();
        });
        this.controller.onBoardFlip(() => {
            if (this.orientation === "white") {
                this.orientation = "black";
            } else {
                this.orientation = "white";
            }
        });
        this.tree.version$.subscribe(async () => {
            try {
                // console.lg(`version: ${this.tree.version$.getValue()}`);
                this.position = this.tree.fen();
                if (this.boardA) {
                    this.boardA.setPosition(this.position, this.useAnimation);
                }
                if (this.boardC) {
                    this.boardC.setPosition(this.position, this.useAnimation);
                }
                if (this.engineNode) {
                    // Any further events will be discarded.
                    this.engineNode = null;
                    // Wait for the engine to stop.
                    const stopinfo: BestMove = await this.controller.halt();
                    // TODO: We could apply this knowledge to the previous node...
                    stopinfo.bestmove;
                    stopinfo.ponder;
                    for (const moveScore of stopinfo.info) {
                        moveScore.pv;
                    }
                    // console.lg(`bestmove => ${JSON.stringify(stopinfo)}`);
                    // Restart analysis for the new position.
                    this.engineNode = this.tree.node;
                    const fen = this.engineNode.position.fen(true);
                    await this.controller.go(fen);
                } else {
                    // console.lg("There is no search in progress");
                }
            } catch (ex) {
                console.log(`${ex}`);
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
                    // console.lg(`moveinfo[${move}] => ${JSON.stringify(moveinfo)}`);
                }
                // Having just updated the position information, we can sort it to determine the best move ordering.
                const pvis = sorted_primary_variations(this.engineNode).map((pvi) => {
                    return { move: pvi.move, cp: pvi.cp, line: pvi.pv };
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
        if (this.boardA) {
            this.boardA.sparePieces = true;
            this.boardA.dropOffBoard = "trash";
        }
        if (this.boardC) {
            this.boardC.sparePieces = true;
            this.boardC.dropOffBoard = "trash";
        }
        this.updateStatus();
    }
    exitSetupMode() {
        if (this.boardA) {
            this.boardA.sparePieces = false;
            this.boardA.dropOffBoard = "snapback";
        }
        if (this.boardC) {
            this.boardC.sparePieces = false;
            this.boardC.dropOffBoard = "snapback";
        }
        this.is_setup_mode = false;
        try {
            if (this.boardA) {
                const fen = `${this.boardA.fen()} w KQkq - 0 1`;
                // console.lg("fen", fen);
                if (fen) {
                    // The
                    this.tree.load(fen);
                }
            }
            if (this.boardC) {
                const fen = `${this.boardC.fen()} w KQkq - 0 1`;
                // console.lg("fen", fen);
                if (fen) {
                    // The
                    this.tree.load(fen);
                }
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
            this.position = this.tree.fen();
            this.pgn = this.tree.pgn();
        }
    }
    /**
     * It is safe to call this with illegal moves.
     * @param move is a string of the form {from}{to}[{promotion}], (algebraic) even for captures. promotion is optional.
     */
    move(move: string): LegalMove | null {
        // console.lg(`AppComponent.move(move=${move})`)
        // It is safe to call this with illegal moves.
        if (typeof move !== "string") {
            throw new Error();
        }

        const board = this.tree.node.position;
        const source = point_from_s(move.slice(0, 2));
        const target = point_from_s(move.slice(2, 4));
        const promotion = move.slice(4, 1);

        if (!source) {
            throw new Error("invalid source square");
        }

        if (!target) {
            throw new Error("invalid target square");
        }

        // First deal with old-school castling in Standard Chess...

        const s = board.c960_castling_converter(move);

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

        // TODO: The problem here is that we actually modify the tree, incrementing the version, that causes
        // an update of the board, which causes an animation...
        this.tree.make_move(s);

        return { from: source.s, to: target.s };
    }

    compute_legal_move(move: string): LegalMove | null {
        // console.lg(`AppComponent.compute_legal_move(move=${move})`)
        // It is safe to call this with illegal moves.
        if (typeof move !== "string") {
            throw new Error();
        }

        const board = this.tree.node.position;
        const source = point_from_s(move.slice(0, 2));
        const target = point_from_s(move.slice(2, 4));
        const promotion = move.slice(4, 1);

        if (!source) {
            throw new Error("invalid source square");
        }

        if (!target) {
            throw new Error("invalid target square");
        }

        // First deal with old-school castling in Standard Chess...

        const s = board.c960_castling_converter(move);

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

    onChange(event: ChangeEvent): void { }
    onDragStart(event: DragStartEvent): void {
        const { source, piece, position, orientation } = event.detail;
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
    }
    onDragMove(event: DragMoveEvent): void { }
    onDropEvent(event: DropEvent): void {
        const { source, target, piece, newPosition, oldPosition, orientation, setAction } = event.detail;
        // console.lg(`onDropEvent(source=${source}, target=${target})`);
        if (this.is_setup_mode) {
            // Do nothing
        } else {
            // see if the move is legal, we really don't
            try {
                const move = this.compute_legal_move(`${source}${target}`);
                if (move) {
                    // Legal move
                }
                else {
                    setAction("snapback");
                }
                /*
                const ignore: Move = this.game.move({
                    from: source,
                    to: target,
                    promotion: "q" // NOTE: always promote to a queen for example simplicity. What happens if not specified?
                });
                */
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
    }
    onSnapEndEvent(event: SnapEndEvent): void {
        const { piece, source, square } = event.detail;
        // console.lg(`onSnapEndEvent piece=${piece} source=${source}, square=${square}`)

        if (this.is_setup_mode) {
            if (this.boardA) {
                const position = this.boardA.fen();
                if (position) {
                    this.position = position;
                }
            } else if (this.boardC) {
                const position = this.boardC.fen();
                if (position) {
                    this.position = position;
                }
            }
        } else {
            const move = this.move(`${source}${square}`);
            if (move) {
                // Legal move
            }
            else {
                console.warn("Illegal move. Something is rotten in Denmark.");
            }

            // update the board position after the piece snap
            // for castling, en passant, pawn promotion
            this.position = this.tree.fen();
        }
        this.updateStatus();
    }
    onSnapbackEndEvent(event: SnapbackEndEvent): void { }
    onMoveEndEvent(event: MoveEndEvent): void { }
    onMouseoverSquareEvent(event: MouseoverSquareEvent): void { }
    onMouseoutSquareEvent(event: MouseoutSquareEvent): void { }
}
