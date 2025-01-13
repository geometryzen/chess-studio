import { booleanAttribute, Component, ElementRef, EventEmitter, Input, numberAttribute, OnDestroy, OnInit, Output } from "@angular/core";
import { Animation, calculateAnimations } from "src/libs/chessboard/calculate_animations";
import { calculatePositionFromMoves, fenToObj, normalizePosition, objToFen, Piece, Position, PositionObject, validMove, validPositionObject, validSquare } from "src/libs/chessboard/chess-utils";
import { copy_position } from "src/libs/chessboard/copy_position";
import { different_positions } from "src/libs/chessboard/equal_positions";
import { update_position_source_target } from "src/libs/chessboard/update_position_source_target";
import { ChessPiece } from "./chesspiece.component";

type Coord = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

// default animation speeds
const DEFAULT_APPEAR_SPEED = 200;
const DEFAULT_MOVE_SPEED = 200;
const DEFAULT_SNAP_SPEED = 30;
const DEFAULT_SNAPBACK_SPEED = 60;
const DEFAULT_TRASH_SPEED = 100;

export type AnimationSpeed = "fast" | "slow" | number;

export type SquareColor = "black" | "white";
export type Offset = { top: number; left: number };
// TODO: It would be nice for this to be restricted to the 64 squares.
export type Location = string;
export type OffBoardAction = "trash" | "snapback";
export type Action = OffBoardAction | "drop";

//
// "dragging" can be followed by "snap" meaning that the piece snaps into the location where dropped.
//                               "snapback" meaning that the piece returns to the source location.
//                               "trash" meaning that the piece is removed from the board.
//
type DraggingDragState = {
    state: "dragging";
    x: number;
    y: number;
    piece: Piece;
    location: Location | "offboard" | "spare";
    source: Location | "spare";
};
type SnapDragState = {
    state: "snap";
    piece: Piece;
    location: Location;
    source: Location;
};
type SnapbackDragState = {
    state: "snapback";
    piece: Piece;
    source: Location;
};
type TrashDragState = {
    state: "trash";
    x: number;
    y: number;
    piece: Piece;
    source: Location;
};

type DragState = DraggingDragState | SnapbackDragState | TrashDragState | SnapDragState;

function assertIsDragging(dragState: DragState | undefined): asserts dragState is DraggingDragState {
    if (dragState?.state !== "dragging") {
        throw new Error(`unexpected drag state ${JSON.stringify(dragState)}`);
    }
}

const speedToMS = (speed: AnimationSpeed) => {
    if (typeof speed === "number") {
        return speed;
    }
    if (speed === "fast") {
        return 200;
    }
    if (speed === "slow") {
        return 600;
    }
    return parseInt(speed, 10);
};

const squareId = (square: Location) => `square-${square}`;
const sparePieceId = (piece: Piece) => `spare-piece-${piece}`;

export interface ChangeEvent extends Event {
    detail: {
        value: PositionObject;
        oldValue: PositionObject;
    };
}

export interface DragStartEvent extends Event {
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

export interface DragMoveEvent extends Event {
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

export interface DropEvent extends Event {
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
        /**
         * The default action will be to allow the drop.
         */
        setAction: (action: "snapback" | "trash") => void;
    };
}

export interface SnapEndEvent extends Event {
    detail: {
        piece: string;
        source: string;
        square: string;
    };
}

export interface SnapbackEndEvent extends Event {
    detail: {
        piece: string;
        square: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

export interface MoveEndEvent extends Event {
    detail: {
        oldPosition: PositionObject;
        newPosition: PositionObject;
    };
}

export interface MouseoverSquareEvent extends Event {
    detail: {
        piece: string | false;
        square: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

export interface MouseoutSquareEvent extends Event {
    detail: {
        piece: string | false;
        square: string;
        position: PositionObject;
        orientation: "white" | "black";
    };
}

@Component({
    selector: "chessstudio-board",
    templateUrl: "./chessboard.component.html",
    styleUrls: ["./chessboard.component.scss"],
    schemas: [],
    imports: [ChessPiece],
    standalone: true
})
export class ChessBoard implements OnInit, OnDestroy {
    // x and y coordinates are computer graphics convention when the board point of view is white...
    // (0,0) <=> a8
    // (7,0) <=> h8
    // (0,7) <=> a1
    // (7,7) <=> h1
    readonly xs = [0, 1, 2, 3, 4, 5, 6, 7] as const;
    readonly ys = [0, 1, 2, 3, 4, 5, 6, 7] as const;
    @Input()
    set position(position: string) {
        const pieces: PositionObject | false = fenToObj(position);
        if (pieces) {
            this.#set_current_position(pieces);
            // this.foobar(pieces);
        } else {
            // console.lg(`${position} is NOT a valid position`)
        }
    }

    readonly pieces: PositionObject = {};

    @Input() orientation: "white" | "black" = "white";
    @Input({ alias: "draggable-pieces", transform: booleanAttribute }) draggablePieces: boolean = false;
    @Input({ alias: "spare-pieces", transform: booleanAttribute }) sparePieces: boolean = false;
    // TODO: Some work required to support "fast" and "slow"
    @Input({ alias: "move-speed", transform: numberAttribute }) moveSpeed: AnimationSpeed = DEFAULT_MOVE_SPEED;
    @Input({ alias: "trash-speed", transform: numberAttribute }) trashSpeed: AnimationSpeed = DEFAULT_TRASH_SPEED;
    @Input({ alias: "appear-speed", transform: numberAttribute }) appearSpeed: AnimationSpeed = DEFAULT_APPEAR_SPEED;
    @Input({ alias: "snap-speed", transform: numberAttribute }) snapSpeed: AnimationSpeed = DEFAULT_SNAP_SPEED;
    @Input({ alias: "snapback-speed", transform: numberAttribute }) snapbackSpeed: AnimationSpeed = DEFAULT_SNAPBACK_SPEED;
    /**
     * Set to 'trash' to remove pieces when they are dropped outside the board.
     */
    @Input({ alias: "drop-off-board" }) dropOffBoard: OffBoardAction = "snapback";

    #dragState?: DragState;
    /**
     * https://developer.mozilla.org/en-US/docs/Web/API/Element/transitionend_event
     *
     * If the transition-property is removed or display is set to none, then the event will not be generated.
     */
    cssTransitionEnabled: boolean = true;

    private get _squareSize() {
        // Note: this isn't cached, but is called during user interactions, so we
        // have a bit of time to use under RAIL guidelines.
        // TODO: Problematic for Angular
        // return this.offsetWidth / 8;
        return 60;
    }

    private _getSquareElement(square: Location): HTMLElement {
        // TODO: squareId needs to be more unique since we're no longer working from just the shadow root.
        return document.getElementById(squareId(square))!;
    }

    private _getSparePieceElement(piece: Piece): HTMLElement {
        // TODO: squareId needs to be more unique since we're no longer working from just the shadow root.
        return document.getElementById(sparePieceId(piece))!;
    }
    private readonly _highlightedSquares = new Set();
    /**
     * A map from a square (Location) to an Animation.
     */
    private _animations = new Map<Location, Animation>();
    // I'm not sure whether these can be private?
    // Don't really want emit to be part of the public API.
    @Output("changed") private changedEvents$ = new EventEmitter<ChangeEvent>();
    @Output("drag-start") dragStart$ = new EventEmitter<DragStartEvent>();
    @Output("drag-move") dragMove$ = new EventEmitter<DragMoveEvent>();
    @Output("drop") drop$ = new EventEmitter<DropEvent>();
    // Why is this called snap-end and not drop end maybe drop-snap-end and drop-snapback-end
    @Output("snap-end") snapEnd$ = new EventEmitter<SnapEndEvent>();
    @Output("snapback-end") snapbackEnd$ = new EventEmitter<SnapbackEndEvent>();
    @Output("move-end") moveEnd$ = new EventEmitter<MoveEndEvent>();
    @Output("mouseover-square") mouseoverSquare$ = new EventEmitter<MouseoverSquareEvent>();
    @Output("mouseout-square") mouseoutSquare$ = new EventEmitter<MouseoutSquareEvent>();

    constructor(private el: ElementRef<HTMLElement>) {
        this.pieces["a8"] = "bR";
        this.pieces["b8"] = "bN";
        this.pieces["c8"] = "bB";
        this.pieces["d8"] = "bQ";
        this.pieces["e8"] = "bK";
        this.pieces["f8"] = "bB";
        this.pieces["g8"] = "bN";
        this.pieces["h8"] = "bR";
        this.pieces["a7"] = "bP";
        this.pieces["b7"] = "bP";
        this.pieces["c7"] = "bP";
        this.pieces["d7"] = "bP";
        this.pieces["e7"] = "bP";
        this.pieces["f7"] = "bP";
        this.pieces["g7"] = "bP";
        this.pieces["h7"] = "bP";

        this.pieces["a2"] = "wP";
        this.pieces["b2"] = "wP";
        this.pieces["c2"] = "wP";
        this.pieces["d2"] = "wP";
        this.pieces["e2"] = "wP";
        this.pieces["f2"] = "wP";
        this.pieces["g2"] = "wP";
        this.pieces["h2"] = "wP";
        this.pieces["a1"] = "wR";
        this.pieces["b1"] = "wN";
        this.pieces["c1"] = "wB";
        this.pieces["d1"] = "wQ";
        this.pieces["e1"] = "wK";
        this.pieces["f1"] = "wB";
        this.pieces["g1"] = "wN";
        this.pieces["h1"] = "wR";
    }
    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Sets the position of the board.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *   show the new position instantly.
     */
    setPosition(position: Position, useAnimation: boolean): void | never {
        // console.lg(`setPosition(position=${JSON.stringify(position)}, useAnimation=${useAnimation})`);
        const positionObj = normalizePosition(position);

        // validate position object
        if (validPositionObject(positionObj)) {
            if (useAnimation) {
                const animations = calculateAnimations(this.pieces, positionObj);
                this._doAnimations(animations, this.pieces, positionObj);
            }
            this.#set_current_position(positionObj);
        } else {
            throw new Error("Invalid position", positionObj);
        }
    }
    /**
     * Returns the current position as a FEN string.
     */
    fen() {
        return objToFen(this.pieces);
    }

    /**
     * Sets the board to the start position.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *   show the new position instantly.
     */
    start(useAnimation: boolean) {
        this.setPosition("start", useAnimation);
    }

    /**
     * Removes all the pieces on the board. If `useAnimation` is `false`, removes
     * pieces instantly.
     *
     * This is shorthand for `setPosition({})`.
     *
     * @param useAnimation If `true`, animate to the new position. If `false`,
     *   show the new position instantly.
     */
    clear(useAnimation: boolean) {
        this.setPosition({}, useAnimation);
        this._highlightedSquares.clear();
        this._animations.clear();
    }

    /**
     * Executes one or more moves on the board.
     *
     * Moves are strings the form of "e2-e4", "f6-d5", etc., Pass `false` as an
     * argument to disable animation.
     */
    move(...args: Array<string | false>) {
        let useAnimation = true;

        // collect the moves into an object
        const moves: { [from: string]: string } = {};
        for (const arg of args) {
            // any "false" to this function means no animations
            if (arg === false) {
                useAnimation = false;
                continue;
            }

            // skip invalid arguments
            if (!validMove(arg)) {
                throw new Error("Invalid move", arg);
            }

            const [from, to] = arg.split("-");
            moves[from] = to;
        }

        // calculate position from moves
        const newPos = calculatePositionFromMoves(this.pieces, moves);

        // update the board
        this.setPosition(newPos, useAnimation);

        // return the new position object
        return newPos;
    }

    /**
     * Flip the orientation.
     */
    flip() {
        this.orientation = this.orientation === "white" ? "black" : "white";
    }

    /**
     * Recalculates board and square sizes based on the parent element and redraws
     * the board accordingly.
     */
    resize() {
    }

    file(x: Coord): File {
        return this.orientation === "white" ? FILES[x] : FILES[7 - x];
    }
    rank(y: Coord): Rank {
        return this.orientation === "white" ? RANKS[y] : RANKS[7 - y];
    }
    square(x: Coord, y: Coord): string {
        return `${this.file(x)}${this.rank(y)}`;
    }
    squareColor(x: Coord, y: Coord): "white" | "black" {
        return (x + y) % 2 > 0 ? "black" : "white";
    }
    /**
     * Used by the template to determine how a square should be highlighted.
     * The template is rather complex in computing the part attribute so maybe that should be a method itself
     * @param square
     * @returns
     */
    highlight(square: string): "highlight" | "" {
        const isDragSource = square === this.#dragState?.source;
        const highlight = (isDragSource || this._highlightedSquares.has(square)) ? "highlight" : "";
        return highlight;
    }
    ngOnInit(): void {
        // console.lg("ChessBoard.ngOnInit");
        // TODO: By using Observables wecan make the handlers into local functions, simplifying the API surface.
        // const subscription = fromEvent(window, "touchmove", { passive: false }).subscribe(this.on_mousemove_window);
        window.addEventListener("mousemove", this.#on_mousemove_window);
        window.addEventListener("touchmove", this.#on_mousemove_window, {
            passive: false
        });
        window.addEventListener("mouseup", this.#on_mouseup_window);
        window.addEventListener("touchend", this.#on_mouseup_window, {
            passive: false
        });
    }
    ngOnDestroy(): void {
        // console.lg("ChessBoard.ngOnDestroy");
        window.removeEventListener("mousemove", this.#on_mousemove_window);
        window.removeEventListener("mouseup", this.#on_mouseup_window);
        window.removeEventListener("touchmove", this.#on_mousemove_window);
        window.removeEventListener("touchend", this.#on_mouseup_window);
    }
    private _getAnimationStyles(piece: Piece | undefined, animation?: Animation | undefined): Partial<CSSStyleDeclaration> {
        // console.lg(`_getAnimationStyles(piece=${piece}, animation=${JSON.stringify(animation)})`);
        if (animation) {
            if (piece && (animation.type === "move-start" || (animation.type === "add-start" && this.draggablePieces))) {
                // Position the moved piece absolutely at the source
                const sourceSquare = animation.type === "move-start" ? this._getSquareElement(animation.source) : this._getSparePieceElement(piece);
                const targetSquare = animation.type === "move-start" ? this._getSquareElement(animation.target) : this._getSquareElement(animation.square);

                if (!sourceSquare) {
                    console.warn(JSON.stringify(animation));
                }

                const sourceSquareRect = sourceSquare.getBoundingClientRect();
                const targetSquareRect = targetSquare.getBoundingClientRect();

                return {
                    position: "absolute",
                    left: `${sourceSquareRect.left - targetSquareRect.left}px`,
                    top: `${sourceSquareRect.top - targetSquareRect.top}px`,
                    width: `${this._squareSize}px`,
                    height: `${this._squareSize}px`
                };
            }
            if (piece && (animation.type === "move" || (animation.type === "add" && this.draggablePieces))) {
                // Transition the moved piece to the destination
                return {
                    position: "absolute",
                    transitionProperty: "top, left",
                    transitionDuration: `${speedToMS(this.moveSpeed)}ms`,
                    top: `0`,
                    left: `0`,
                    width: `${this._squareSize}px`,
                    height: `${this._squareSize}px`
                };
            }
            if (!piece && animation.type === "clear") {
                // Preserve and transition a removed piece to opacity 0
                piece = animation.piece;
                return {
                    transitionProperty: "opacity",
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: "0"
                };
            }
            if (piece && animation.type === "add-start") {
                // Initialize an added piece to opacity 0
                return {
                    opacity: "0"
                };
            }
            if (piece && animation.type === "add") {
                // Transition an added piece to opacity 1
                return {
                    transitionProperty: "opacity",
                    transitionDuration: `${speedToMS(this.appearSpeed)}ms`
                };
            }
        }
        return {};
    }

    _mousedownSquare(e: MouseEvent | TouchEvent): void {
        // do nothing if we're not draggable. sparePieces implies draggable
        if (!this.draggablePieces && !this.sparePieces) {
            return;
        }

        // do nothing if there is no piece on this square
        const squareEl = e.currentTarget as HTMLElement;
        const square = squareEl.getAttribute("data-square");
        if (square === null || !this.pieces.hasOwnProperty(square)) {
            return;
        }
        e.preventDefault();
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
        this._beginDraggingPiece(square, this.pieces[square]!, pos.clientX, pos.clientY);
    }
    _mousedownSparePiece(e: MouseEvent | TouchEvent) {
        // do nothing if sparePieces is not enabled
        if (!this.sparePieces) {
            return;
        }
        const sparePieceContainerEl = e.currentTarget as HTMLElement;
        const pieceEl = sparePieceContainerEl.querySelector("[part~=piece]");
        //
        const piece = pieceEl!.getAttribute("piece")! as Piece;
        e.preventDefault();
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
        this._beginDraggingPiece("spare", piece, pos.clientX, pos.clientY);
    }
    _mouseenterSquare(e: Event): void {
        // do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this.#dragState !== undefined) {
            return;
        }

        // get the square
        const square: string | null = (e.currentTarget as HTMLElement).getAttribute("data-square");

        // NOTE: this should never happen; defensive
        if (!validSquare(square)) {
            return;
        }

        // Get the piece on this square
        const piece = this.pieces.hasOwnProperty(square) && this.pieces[square]!;

        const moseoverSquareEvent: MouseoverSquareEvent = new CustomEvent("mouseover-square", {
            bubbles: true,
            detail: {
                square,
                piece,
                position: copy_position(this.pieces),
                orientation: this.orientation
            }
        });

        this.mouseoverSquare$.emit(moseoverSquareEvent);
    }
    _mouseleaveSquare(e: Event): void {
        // Do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this.#dragState !== undefined) {
            return;
        }

        const square = (e.currentTarget as HTMLElement).getAttribute("data-square");

        // NOTE: this should never happen; defensive
        if (!validSquare(square)) {
            return;
        }

        // Get the piece on this square
        const piece = this.pieces.hasOwnProperty(square) && this.pieces[square]!;

        // execute their function
        const mouseoutSquareEvent = new CustomEvent("mouseout-square", {
            bubbles: true,
            detail: {
                square,
                piece,
                position: copy_position(this.pieces),
                orientation: this.orientation
            }
        });
        this.mouseoutSquare$.emit(mouseoutSquareEvent);
    }
    #on_mousemove_window = (e: MouseEvent | TouchEvent) => {
        if (this.is_dragging()) {
            // Prevent screen from scrolling
            e.preventDefault();
            const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
            this._updateDraggedPiece(pos.clientX, pos.clientY);
        }
    };

    #on_mouseup_window = (e: MouseEvent | TouchEvent) => {
        if (this.is_dragging()) {
            const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
            const location = this.location_from_point(pos.clientX, pos.clientY);
            this._stopDraggedPiece(location);
        }
    };

    private _beginDraggingPiece(source: string, piece: Piece, x: number, y: number) {
        // Fire cancelable drag-start event
        const dragStartEvent = new CustomEvent("drag-start", {
            bubbles: true,
            cancelable: true,
            detail: {
                source,
                piece,
                position: copy_position(this.pieces),
                orientation: this.orientation
            }
        });
        this.dragStart$.emit(dragStartEvent);

        if (dragStartEvent.defaultPrevented) {
            return;
        }

        // set state
        this.#dragState = {
            state: "dragging",
            x,
            y,
            piece,
            // if the piece came from spare pieces, location is offboard
            location: (source === "spare") ? "offboard" : source,
            source
        };
    }

    private _updateDraggedPiece(x: number, y: number) {
        assertIsDragging(this.#dragState);

        // put the dragged piece over the mouse cursor
        this.#dragState.x = x;
        this.#dragState.y = y;

        const location: Location | "offboard" = this.location_from_point(x, y);

        // do nothing more if the location has not changed
        if (location === this.#dragState.location) {
            return;
        }

        // remove highlight from previous square
        if (validSquare(this.#dragState.location)) {
            this._highlightSquare(this.#dragState.location, false);
        }

        // add highlight to new square
        if (validSquare(location)) {
            this._highlightSquare(location);
        }

        const dragMoveEvent = new CustomEvent("drag-move", {
            bubbles: true,
            detail: {
                newLocation: location,
                oldLocation: this.#dragState.location,
                source: this.#dragState.source,
                piece: this.#dragState.piece,
                position: copy_position(this.pieces),
                orientation: this.orientation
            }
        });
        this.dragMove$.emit(dragMoveEvent);

        // update state
        this.#dragState.location = location;
    }

    /**
     *
     * @param location
     */
    private async _stopDraggedPiece(location: Location | "offboard") {
        // console.lg(`stopDraggingPiece(location=${location})`);
        assertIsDragging(this.#dragState);
        const { source, piece } = this.#dragState;

        // determine what the action should be
        let action: Action = "drop";
        if (location === "offboard") {
            action = (this.dropOffBoard === "trash") ? "trash" : "snapback";
        }

        const newPosition = copy_position(this.pieces);
        const oldPosition = copy_position(this.pieces);

        // source piece is a spare piece and position is on the board
        if (source === "spare" && validSquare(location)) {
            // add the piece to the board
            newPosition[location] = piece;
        }

        // source piece was on the board
        if (validSquare(source)) {
            // remove the piece from the board
            delete newPosition[source];
            // new position is on the board
            if (validSquare(location)) {
                // move the piece
                newPosition[location] = piece;
            }
        }

        // Fire the drop event
        // Listeners can potentially change the drop action
        // Notice that the changing of the action is synchronous
        const dropEvent = new CustomEvent("drop", {
            bubbles: true,
            detail: {
                source,
                target: location,
                piece,
                newPosition,
                oldPosition,
                orientation: this.orientation,
                setAction(a: Action) {
                    action = a;
                }
            }
        });

        this.drop$.emit(dropEvent);

        this._highlightedSquares.clear();

        // do it!
        // console.lg("action", action);
        if (action === "snapback") {
            await this._snapbackDraggedPiece();
        } else if (action === "trash") {
            await this._trashDraggedPiece();
        } else if (action === "drop") {
            await this._dropDraggedPieceOnSquare(location);
        }

        // clear state
        // console.lg("clear drag state");
        this.#dragState = undefined;
    }
    #set_current_position(pieces: Readonly<PositionObject>): void {
        if (different_positions(this.pieces, pieces)) {
            const oldValue = copy_position(this.pieces);

            update_position_source_target(pieces, this.pieces);

            this.changedEvents$.emit(
                new CustomEvent("change", {
                    bubbles: true,
                    detail: {
                        value: copy_position(pieces),
                        oldValue
                    }
                })
            );
        }
    }

    private location_from_point(x: number, y: number): Location | "offboard" {
        // TODO: remove cast when TypeScript fixes ShadowRoot.elementsFromPoint
        const elements = document.elementsFromPoint(x, y);
        const squareEl = elements.find((e) => e.classList.contains("square"));
        const square = (squareEl === undefined) ? "offboard" : (squareEl.getAttribute("data-square") as Location);
        return square;
    }

    private _highlightSquare(square: Location, value = true) {
        if (value) {
            this._highlightedSquares.add(square);
        } else {
            this._highlightedSquares.delete(square);
        }
    }
    private async _snapbackDraggedPiece() {
        assertIsDragging(this.#dragState);
        const { source, piece } = this.#dragState;

        // there is no "snapback" for spare pieces
        if (source === "spare") {
            return this._trashDraggedPiece();
        }

        this.#dragState = {
            state: "snapback",
            piece,
            source
        };

        // Wait for a paint
        await new Promise((resolve) => setTimeout(resolve, 0));

        if (this.cssTransitionEnabled) {
            return new Promise<void>((resolve) => {
                const transitionComplete = () => {
                    if (draggedPieceElement) {
                        draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                    }
                    resolve();

                    const snapbackEndEvent = new CustomEvent("snapback-end", {
                        bubbles: true,
                        detail: {
                            piece: piece,
                            square: source,
                            position: copy_position(this.pieces),
                            orientation: this.orientation
                        }
                    });
                    this.snapbackEnd$.emit(snapbackEndEvent);
                };
                const draggedPieceElement = document.querySelector('[part~="dragged-piece"]');
                if (draggedPieceElement) {
                    draggedPieceElement.addEventListener("transitionend", transitionComplete);
                }
            });
        }
    }

    private async _trashDraggedPiece() {
        assertIsDragging(this.#dragState);
        const { source, piece, location, state, x, y } = this.#dragState;

        // remove the source piece
        const newPosition = copy_position(this.pieces);
        delete newPosition[source];
        this.#set_current_position(newPosition);

        this.#dragState = {
            state: "trash",
            piece,
            x: this.#dragState.x,
            y: this.#dragState.y,
            source: this.#dragState.source
        };

        // Wait for a paint
        await new Promise((resolve) => setTimeout(resolve, 0));

        if (this.cssTransitionEnabled) {
            return new Promise<void>((resolve) => {
                const transitionComplete = () => {
                    if (draggedPieceElement) {
                        draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                    }
                    resolve();

                    // There is no event for signifying that the piece has been trashed.
                };
                const draggedPieceElement = document.querySelector('[part~="dragged-piece"]');
                if (draggedPieceElement) {
                    draggedPieceElement.addEventListener("transitionend", transitionComplete);
                }
            });
        }
    }

    private async _dropDraggedPieceOnSquare(square: string): Promise<void> {
        // console.lg("dropDraggedPieceInSquare")
        assertIsDragging(this.#dragState);
        const { source, piece } = this.#dragState;

        // update position
        const newPosition = copy_position(this.pieces);
        delete newPosition[source];
        newPosition[square] = piece;
        this.#set_current_position(newPosition);

        this.#dragState = {
            state: "snap",
            piece,
            location: square,
            source: square
        };

        // Wait for a paint

        // If we don't wait for a paint...
        await new Promise((resolve) => setTimeout(resolve, 0));

        if (this.cssTransitionEnabled) {
            return new Promise<void>((resolve) => {
                const transitionComplete = () => {
                    if (draggedPieceElement) {
                        draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                    }
                    resolve();

                    // Fire the snap-end event
                    const snapEndEvent = new CustomEvent("snap-end", {
                        bubbles: true,
                        detail: {
                            source,
                            square,
                            piece
                        }
                    });
                    this.snapEnd$.emit(snapEndEvent);
                };
                // Not as efficient as coming through shadowRoot...
                const draggedPieceElement = document.querySelector('[part~="dragged-piece"]');
                if (draggedPieceElement) {
                    draggedPieceElement.addEventListener("transitionend", transitionComplete);
                }
            });
        }
    }

    // execute an array of animations
    private async _doAnimations(animations: Animation[], oldPos: Readonly<PositionObject>, newPos: Readonly<PositionObject>) {
        // console.lg("doAnimations()")
        // console.lg(JSON.stringify(animations));
        // console.lg("_animations 1", JSON.stringify([...this._animations.entries()]));
        if (animations.length === 0) {
            return;
        }

        let numFinished = 0;
        const transitionEndListener = () => {
            numFinished++;

            if (numFinished === animations.length) {
                document.removeEventListener("transitionend", transitionEndListener);
                this._animations.clear();

                const moveEndEvent = new CustomEvent("move-end", {
                    bubbles: true,
                    detail: {
                        oldPosition: copy_position(oldPos),
                        newPosition: copy_position(newPos)
                    }
                });
                this.moveEnd$.emit(moveEndEvent);
            }
        };
        document.addEventListener("transitionend", transitionEndListener);

        // Render once with added pieces at opacity 0
        this._animations.clear();
        for (const animation of animations) {
            // console.lg("animation", JSON.stringify(animation))
            if (animation.type === "add" || animation.type === "add-start") {
                this._animations.set(animation.square, {
                    ...animation,
                    type: "add-start"
                });
            } else if (animation.type === "move" || animation.type === "move-start") {
                this._animations.set(animation.target, {
                    ...animation,
                    type: "move-start"
                });
            } else {
                this._animations.set(animation.square, animation);
            }
        }

        // Wait for a paint
        // console.lg("_animations 2", JSON.stringify([...this._animations.entries()]));
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Render again with the piece at opacity 1 with a transition
        this._animations.clear();
        for (const animation of animations) {
            if (animation.type === "move" || animation.type === "move-start") {
                this._animations.set(animation.target, animation);
            } else {
                this._animations.set(animation.square, animation);
            }
        }
    }

    is_drag_state(): boolean {
        return !!this.#dragState;
    }

    is_dragging(): boolean {
        if (this.#dragState) {
            const state = this.#dragState.state;
            switch (state) {
                case "dragging": {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Determines if the square is one we are dragging from.
     */
    is_dragged_square(square: Location): boolean {
        if (this.#dragState) {
            const state = this.#dragState.state;
            switch (state) {
                case "dragging":
                case "snap":
                case "snapback":
                case "trash": {
                    return this.#dragState.source === square;
                }
            }
        }
        return false;
    }

    animation_style(square: Location): Partial<CSSStyleDeclaration> {
        const piece = this.pieces[square];
        const animation = this._animations.get(square);
        const more = this._getAnimationStyles(piece, animation);
        // console.lg("more", JSON.stringify(more))
        const styles: Partial<CSSStyleDeclaration> = {
            opacity: "1",
            transitionProperty: "none", // Maybe should be none?
            transitionDuration: "0ms",
            ...more
        };
        if (this.is_dragged_square(square)) {
            styles.display = "none";
        }
        return styles;
    }

    /**
     * TODO: I don't think this need the animation stuff?
     * Unless it is for resetting purposes?
     */
    dragged_piece_styles(): Partial<CSSStyleDeclaration> {
        const styles: Partial<CSSStyleDeclaration> = {
            height: `${this._squareSize}px`,
            width: `${this._squareSize}px`,
            opacity: "1",
            transitionProperty: "none",
            transitionDuration: "0ms",
            position: "absolute"
        };
        const dragState = this.#dragState;
        if (dragState !== undefined) {
            styles.display = "block";
            const rect = this.el.nativeElement.getBoundingClientRect();

            if (dragState.state === "dragging") {
                const { x, y } = dragState;
                Object.assign(styles, {
                    top: `${y - rect.top - this._squareSize / 2}px`,
                    left: `${x - rect.left - this._squareSize / 2}px`
                });
            } else if (dragState.state === "snapback") {
                const { source } = dragState;
                const square = this._getSquareElement(source);
                const squareRect = square.getBoundingClientRect();
                Object.assign(styles, {
                    transitionProperty: "top, left",
                    transitionDuration: `${speedToMS(this.snapbackSpeed)}ms`,
                    top: `${squareRect.top - rect.top}px`,
                    left: `${squareRect.left - rect.left}px`
                });
            } else if (dragState.state === "trash") {
                const { x, y } = dragState;
                Object.assign(styles, {
                    transitionProperty: "opacity",
                    transitionDuration: `${speedToMS(this.trashSpeed)}ms`,
                    opacity: "0",
                    top: `${y - rect.top - this._squareSize / 2}px`,
                    left: `${x - rect.left - this._squareSize / 2}px`
                });
            } else if (dragState.state === "snap") {
                const square = this._getSquareElement(dragState.location);
                const squareRect = square.getBoundingClientRect();
                Object.assign(styles, {
                    transitionProperty: "top, left",
                    transitionDuration: `${speedToMS(this.snapSpeed)}ms`,
                    top: `${squareRect.top - rect.top}px`,
                    left: `${squareRect.left - rect.left}px`
                });
            }
        }
        return styles;
    }

    dragged_piece(): string | undefined {
        if (this.#dragState) {
            return this.#dragState.piece;
        } else {
            return void 0;
        }
    }

    on_piece_transitionend(): void {
        console.log("on_piece_transitionend() was called")
    }
}
