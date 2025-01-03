import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";
import "chessboard-element";
import { ChessBoardElement, PositionObject } from "chessboard-element";
import { fromEvent, Observable } from "rxjs";
import { BestMove, FoobarService, MoveCandidate, MoveScore } from "src/app/foobar.service";
// Usage of chess.js is temporary until using our own tree-based implementation.
// The goal will be to achieve at least parity of functionality.
// This should be proved using tests.
import { point_from_s, Square } from "src/libs/Position";
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
export class ChessboardComponent implements OnInit {
    // @ViewChild('board') board: ComponentRef<ChessBoardElement>;
    readonly tree = new Tree(); // This will become the new game: Chess?
    // readonly game = new Chess();
    boardUI!: ChessBoardElement;
    change$!: Observable<ChangeEvent>;
    dragStart$!: Observable<DragStartEvent>;
    status: string = "";
    fen: string = "";
    pgn: string = "";
    useAnimation: boolean = true;
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
            try {
                this.tree.reset();
                this.boardUI.setPosition(this.tree.fen(), this.useAnimation);
                this.exitSetupMode();
            } catch (e) {
                console.log(`${e}`);
            }
        });
        this.controller.onGameClear(() => {
            try {
                this.tree.clear();
                this.boardUI.clear(this.useAnimation);
                this.enterSetupMode();
            } catch (e) {
                console.log(`${e}`);
            }
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
        this.tree.version$.subscribe(() => {
            this.boardUI.setPosition(this.tree.fen());
        });
        this.controller.onAnalysisGo(async () => {
            // It matters
            const fen = this.tree.fen(true);
            const retval = await this.controller.go(fen);
            console.log(`go => ${retval}`);
        });
        this.controller.onAnalysisHalt(async () => {
            const retval: BestMove = await this.controller.halt();
            console.log(`halt => ${JSON.stringify(retval)}`);
        });
        this.controller.onAnalysisMoveScore((moveScore: MoveScore) => {
            console.log(`moveScore => ${JSON.stringify(moveScore)}`);
            const moves: string[] = moveScore.pv.split(" ");
            if (moves.length > 0) {
                const move = this.tree.node.board.c960_castling_converter(moves[0]);
                console.log(`move => ${JSON.stringify(move)}`);
                const known = this.tree.node.table.moveinfo[move];
                console.log(`known => ${JSON.stringify(known)}`);
            }
        });
        this.controller.onAnalysisMoveCandidate((moveCandidate: MoveCandidate) => {
            console.log(`moveCandidate => ${JSON.stringify(moveCandidate)}`);
        });
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

        const board = this.tree.node.board;
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
                    console.log(`hub.move(${s}) - ${illegal_reason}`);
                } else {
                    this.show_promotiontable(s);
                }
                return null;
            }
        }

        // The promised legality check...

        const illegal_reason = board.illegal(s);
        if (illegal_reason) {
            console.log(`hub.move(${s}) - ${illegal_reason}`);
            return null;
        }

        this.controller.halt()
        this.tree.make_move(s);
        this.position_changed();
        return { from: source.s, to: target.s };
    }

    position_changed(new_game_flag?: boolean, avoid_confusion?: boolean) {
        console.log("position_changed");
        // Called right after this.tree.node is changed, meaning we are now drawing a different position.

        this.escape();

        // this.hoverdraw_div = -1;
        // this.position_change_time = performance.now();
        // fenbox.value = this.tree.node.board.fen(true);

        if (new_game_flag) {
            // this.node_to_clean = null;
            // this.leela_lock_node = null;
            // this.set_behaviour("halt");					// Will cause "stop" to be sent.
            // if (!config.suppress_ucinewgame) {
            //    this.engine.send_ucinewgame();			// Must happen after "stop" is sent.
            //}
            //this.send_title();
            //if (this.engine.ever_received_uciok && !this.engine.in_960_mode() && this.tree.node.board.normalchess === false) {
            //alert(messages.c960_warning);
            //}
        }

        if (this.tree.node.table.already_autopopulated === false) {
            this.tree.node.table.autopopulate(this.tree.node);
        }

        // When entering a position, clear its searchmoves, unless it's the analysis_locked node.

        //if (this.leela_lock_node !== this.tree.node) {
        //    this.tree.node.searchmoves = [];
        //}

        // Caller can tell us the change would cause user confusion for some modes...

        //if (avoid_confusion) {
        //    if (["play_white", "play_black", "self_play", "auto_analysis", "back_analysis"].includes(config.behaviour)) {
        //        this.set_behaviour("halt");
        //    }
        //}

        // this.maybe_infer_info();						// Before node_exit_cleanup() so that previous ghost info is available when moving forwards.
        // this.behave("position");
        // this.draw();

        // this.node_exit_cleanup();						// This feels like the right time to do this.
        // this.node_to_clean = this.tree.node;

        // this.looker.add_to_queue(this.tree.node.board);

    }
    set_behaviour(s: "halt") {
        /*
        if (!this.engine.ever_received_uciok || !this.engine.ever_received_readyok) {
            s = "halt";
        }

        // Don't do anything if behaviour is already correct. But
        // "halt" always triggers a behave() call for safety reasons.

        if (s === config.behaviour) {
            switch (s) {
                case "halt":
                    break;					// i.e. do NOT immediately return
                case "analysis_locked":
                    if (this.leela_lock_node !== this.tree.node) {
                        break;				// i.e. do NOT immediately return
                    }
                    return;
                case "analysis_free":
                    if (!this.engine.search_desired.node) {
                        break;				// i.e. do NOT immediately return
                    }
                    return;
                default:
                    return;
            }
        }

        this.set_behaviour_direct(s);
        this.behave("behaviour");
        */
    }

    set_behaviour_direct(s: string) {
        /*
        this.leela_lock_node = (s === "analysis_locked") ? this.tree.node : null;
        config.behaviour = s;
        */
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
    escape() {
        // Set things into a clean state.
        /*
        this.hide_fullbox();
        this.hide_promotiontable();
        if (this.active_square) {
            this.set_active_square(null);
            if (config.click_spotlight) {
                this.draw_canvas_arrows();
            }
        }
        */
    }
}
