import { booleanAttribute, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { fenToObj } from "chessboard-element";
import { calculatePositionFromMoves, findClosestPiece, normalizePozition, objToFen, Piece, Position, PositionObject, validMove, validPositionObject, validSquare } from "src/libs/chessboard/chess-utils";
import { deepCopy } from "src/libs/chessboard/utils";
import { ChessPiece } from "./chesspiece.component";

type Coord = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Rank = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8";
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;
type File = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export type AnimationSpeed = "fast" | "slow" | number;

export type SquareColor = "black" | "white";
export type Offset = { top: number; left: number };
export type Location = string;
export type Action = OffBoardAction | "drop";
export type OffBoardAction = "trash" | "snapback";

export type Animation =
    | {
        type: "move";
        source: string;
        destination: string;
        piece: string;
        square?: undefined;
    }
    | {
        type: "move-start";
        source: string;
        destination: string;
        piece: string;
        square?: undefined;
    }
    | {
        type: "add";
        square: string;
        piece: string;
    }
    | {
        type: "clear";
        square: string;
        piece: string;
    }
    | {
        type: "add-start";
        square: string;
        piece: string;
    };

type DraggingDragState = {
    state: "dragging";
    x: number;
    y: number;
    piece: Piece;
    location: Location | "offboard" | "spare";
    source: Location | "spare";
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
type SnapDragState = {
    state: "snap";
    piece: Piece;
    location: Location;
    source: Location;
};

type DragState = DraggingDragState | SnapbackDragState | TrashDragState | SnapDragState;

function assertIsDragging(dragState: DragState | undefined): asserts dragState is DraggingDragState {
    if (dragState?.state !== "dragging") {
        throw new Error(`unexpected drag state ${JSON.stringify(dragState)}`);
    }
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
        const pieces = fenToObj(position);
        if (pieces) {
            this.foobar(pieces);
        }
        else {
            // console.lg(`${position} is NOT a valid position`)
        }
    }

    readonly pieces: { [square: string]: string } = {};
    @Input() orientation: 'white' | 'black' = 'white';
    @Input({ alias: "draggable-pieces", transform: booleanAttribute }) draggablePieces: boolean = false;
    @Input({ alias: "spare-pieces", transform: booleanAttribute }) sparePieces: boolean = false;
    private _dragState?: DragState;
    private _highlightedSquares = new Set();
    private _animations = new Map<Location, Animation>();

    // What is the equivalent of this in Angular?
    // @query('[part~="dragged-piece"]')
    private _draggedPieceElement!: HTMLElement;

    dropOffBoard: OffBoardAction = "snapback";
    @Output() ee = new EventEmitter<Event>();

    constructor() {
        this.pieces["a8"] = 'bR';
        this.pieces["b8"] = 'bN';
        this.pieces["c8"] = 'bB';
        this.pieces["d8"] = 'bQ';
        this.pieces["e8"] = 'bK';
        this.pieces["f8"] = 'bB';
        this.pieces["g8"] = 'bN';
        this.pieces["h8"] = 'bR';
        this.pieces["a7"] = 'bP';
        this.pieces["b7"] = 'bP';
        this.pieces["c7"] = 'bP';
        this.pieces["d7"] = 'bP';
        this.pieces["e7"] = 'bP';
        this.pieces["f7"] = 'bP';
        this.pieces["g7"] = 'bP';
        this.pieces["h7"] = 'bP';

        this.pieces["a2"] = 'wP';
        this.pieces["b2"] = 'wP';
        this.pieces["c2"] = 'wP';
        this.pieces["d2"] = 'wP';
        this.pieces["e2"] = 'wP';
        this.pieces["f2"] = 'wP';
        this.pieces["g2"] = 'wP';
        this.pieces["h2"] = 'wP';
        this.pieces["a1"] = 'wR';
        this.pieces["b1"] = 'wN';
        this.pieces["c1"] = 'wB';
        this.pieces["d1"] = 'wQ';
        this.pieces["e1"] = 'wK';
        this.pieces["f1"] = 'wB';
        this.pieces["g1"] = 'wN';
        this.pieces["h1"] = 'wR';
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
    setPosition(position: Position, useAnimation = true) {
        position = normalizePozition(position);

        // validate position object
        if (!validPositionObject(position)) {
            throw this._error(6482, "Invalid value passed to the position method.", position);
        }

        if (useAnimation) {
            // start the animations
            const animations = this._calculateAnimations(this.pieces, position);
            this._doAnimations(animations, this.pieces, position);
        }
        this._setCurrentPosition(position);
        this.requestUpdate();
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
    start(useAnimation?: boolean) {
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
    clear(useAnimation?: boolean) {
        this.setPosition({}, useAnimation);
        this._highlightedSquares.clear();
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
                this._error(2826, "Invalid move passed to the move method.", arg);
                continue;
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
        this.requestUpdate();
    }

    foobar(pieces: PositionObject) {
        for (const square of Object.keys(this.pieces)) {
            delete this.pieces[square];
        }
        for (const square of Object.keys(pieces)) {
            this.pieces[square] = pieces[square] as string;
        }
    }
    file(x: Coord): File {
        return this.orientation === 'white' ? FILES[x] : FILES[7 - x];
    }
    rank(y: Coord): Rank {
        return this.orientation === 'white' ? RANKS[y] : RANKS[7 - y];
    }
    square(x: Coord, y: Coord): string {
        return `${this.file(x)}${this.rank(y)}`;
    }
    squareColor(x: Coord, y: Coord): 'white' | 'black' {
        return (x + y) % 2 > 0 ? "black" : "white";
    }
    highlight(square: string): "highlight" | "" {
        const isDragSource = square === this._dragState?.source;
        // const animation = this._animations.get(square);
        const highlight = isDragSource || this._highlightedSquares.has(square) ? "highlight" : "";
        return highlight;
    }
    ngOnInit(): void {
        // console.lg("ChessBoard.ngOnInit");
        window.addEventListener("mousemove", this._mousemoveWindow);
        window.addEventListener("mouseup", this._mouseupWindow);
        window.addEventListener("touchmove", this._mousemoveWindow, {
            passive: false
        });
        window.addEventListener("touchend", this._mouseupWindow, {
            passive: false
        });
    }
    ngOnDestroy(): void {
        // console.lg("ChessBoard.ngOnDestroy");
        window.removeEventListener("mousemove", this._mousemoveWindow);
        window.removeEventListener("mouseup", this._mouseupWindow);
        window.removeEventListener("touchmove", this._mousemoveWindow);
        window.removeEventListener("touchend", this._mouseupWindow);
    }
    onMouseDown(e: MouseEvent | TouchEvent): void {
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
    onMouseEnter(e: Event): void {
        // do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this._dragState !== undefined) {
            return;
        }

        // get the square
        const square = (e.currentTarget as HTMLElement).getAttribute("data-square");

        // NOTE: this should never happen; defensive
        if (!validSquare(square)) {
            return;
        }

        // Get the piece on this square
        const piece = this.pieces.hasOwnProperty(square) && this.pieces[square]!;

        this.dispatchEvent(
            new CustomEvent("mouseover-square", {
                bubbles: true,
                detail: {
                    square,
                    piece,
                    position: deepCopy(this.pieces),
                    orientation: this.orientation
                }
            })
        );
    }
    onMouseLeave(e: Event): void {
        // Do not fire this event if we are dragging a piece
        // NOTE: this should never happen, but it's a safeguard
        if (this._dragState !== undefined) {
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
        this.dispatchEvent(
            new CustomEvent("mouseout-square", {
                bubbles: true,
                detail: {
                    square,
                    piece,
                    position: deepCopy(this.pieces),
                    orientation: this.orientation
                }
            })
        );
    }
    private _mousemoveWindow = (e: MouseEvent | TouchEvent) => {
        // Do nothing if we are not dragging a piece
        if (!(this._dragState?.state === "dragging")) {
            return;
        }
        // Prevent screen from scrolling
        e.preventDefault();
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
        this._updateDraggedPiece(pos.clientX, pos.clientY);
    };

    private _mouseupWindow = (e: MouseEvent | TouchEvent) => {
        // Do nothing if we are not dragging a piece
        if (!(this._dragState?.state === "dragging")) {
            return;
        }
        const pos = e instanceof MouseEvent ? e : e.changedTouches[0];
        const location = this._isXYOnSquare(pos.clientX, pos.clientY);
        this._stopDraggedPiece(location);
    };

    private _beginDraggingPiece(source: string, piece: string, x: number, y: number) {
        // Fire cancelable drag-start event
        const event = new CustomEvent("drag-start", {
            bubbles: true,
            cancelable: true,
            detail: {
                source,
                piece,
                position: deepCopy(this.pieces),
                orientation: this.orientation
            }
        });
        this.dispatchEvent(event);
        if (event.defaultPrevented) {
            return;
        }

        // set state
        this._dragState = {
            state: "dragging",
            x,
            y,
            piece,
            // if the piece came from spare pieces, location is offboard
            location: source === "spare" ? "offboard" : source,
            source
        };
        this.requestUpdate();
    }

    private _updateDraggedPiece(x: number, y: number) {
        assertIsDragging(this._dragState);

        // put the dragged piece over the mouse cursor
        this._dragState.x = x;
        this._dragState.y = y;

        this.requestUpdate();

        const location = this._isXYOnSquare(x, y);

        // do nothing more if the location has not changed
        if (location === this._dragState.location) {
            return;
        }

        // remove highlight from previous square
        if (validSquare(this._dragState.location)) {
            this._highlightSquare(this._dragState.location, false);
        }

        // add highlight to new square
        if (validSquare(location)) {
            this._highlightSquare(location);
        }

        this.dispatchEvent(
            new CustomEvent("drag-move", {
                bubbles: true,
                detail: {
                    newLocation: location,
                    oldLocation: this._dragState.location,
                    source: this._dragState.source,
                    piece: this._dragState.piece,
                    position: deepCopy(this.pieces),
                    orientation: this.orientation
                }
            })
        );

        // update state
        this._dragState.location = location;
    }

    private async _stopDraggedPiece(location: Location | "offboard") {
        assertIsDragging(this._dragState);
        const { source, piece } = this._dragState;

        // determine what the action should be
        let action: Action = "drop";
        if (location === "offboard") {
            action = this.dropOffBoard === "trash" ? "trash" : "snapback";
        }

        const newPosition = deepCopy(this.pieces);
        const oldPosition = deepCopy(this.pieces);

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
        this.dispatchEvent(dropEvent);

        this._highlightedSquares.clear();

        // do it!
        if (action === "snapback") {
            await this._snapbackDraggedPiece();
        } else if (action === "trash") {
            await this._trashDraggedPiece();
        } else if (action === "drop") {
            await this._dropDraggedPieceOnSquare(location);
        }

        // clear state
        this._dragState = undefined;

        // Render the final non-dragging state
        this.requestUpdate();
    }
    private _setCurrentPosition(position: PositionObject) {
        const oldPos = deepCopy(this.pieces);
        const newPos = deepCopy(position);
        const oldFen = objToFen(oldPos);
        const newFen = objToFen(newPos);

        // do nothing if no change in position
        if (oldFen === newFen) return;

        // Fire change event
        this.dispatchEvent(
            new CustomEvent("change", {
                bubbles: true,
                detail: {
                    value: newPos,
                    oldValue: oldPos
                }
            })
        );

        // update state
        this.foobar(position);
    }

    private _isXYOnSquare(x: number, y: number): Location | "offboard" {
        // TODO: remove cast when TypeScript fixes ShadowRoot.elementsFromPoint
        const elements = document.elementsFromPoint(x, y);
        const squareEl = elements.find((e) => e.classList.contains("square"));
        const square = squareEl === undefined ? "offboard" : (squareEl.getAttribute("data-square") as Location);
        return square;
    }

    private _highlightSquare(square: Location, value = true) {
        if (value) {
            this._highlightedSquares.add(square);
        } else {
            this._highlightedSquares.delete(square);
        }
        this.requestUpdate("_highlightedSquares");
    }
    private async _snapbackDraggedPiece() {
        assertIsDragging(this._dragState);
        const { source, piece } = this._dragState;

        // there is no "snapback" for spare pieces
        if (source === "spare") {
            return this._trashDraggedPiece();
        }

        this._dragState = {
            state: "snapback",
            piece,
            source
        };

        // Wait for a paint
        this.requestUpdate();
        await new Promise((resolve) => setTimeout(resolve, 0));

        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                if (this._draggedPieceElement) {
                    this._draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                }
                resolve();

                this.dispatchEvent(
                    new CustomEvent("snapback-end", {
                        bubbles: true,
                        detail: {
                            piece: piece,
                            square: source,
                            position: deepCopy(this.pieces),
                            orientation: this.orientation
                        }
                    })
                );
            };
            if (this._draggedPieceElement) {
                this._draggedPieceElement.addEventListener("transitionend", transitionComplete);
            }
        });
    }

    private async _trashDraggedPiece() {
        assertIsDragging(this._dragState);
        const { source, piece } = this._dragState;

        // remove the source piece
        const newPosition = deepCopy(this.pieces);
        delete newPosition[source];
        this._setCurrentPosition(newPosition);

        this._dragState = {
            state: "trash",
            piece,
            x: this._dragState.x,
            y: this._dragState.y,
            source: this._dragState.source
        };

        // Wait for a paint
        this.requestUpdate();
        await new Promise((resolve) => setTimeout(resolve, 0));

        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                if (this._draggedPieceElement) {
                    this._draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                }
                resolve();
            };
            if (this._draggedPieceElement) {
                this._draggedPieceElement.addEventListener("transitionend", transitionComplete);
            }
        });
    }

    private async _dropDraggedPieceOnSquare(square: string) {
        assertIsDragging(this._dragState);
        const { source, piece } = this._dragState;

        // update position
        const newPosition = deepCopy(this.pieces);
        delete newPosition[source];
        newPosition[square] = piece;
        this._setCurrentPosition(newPosition);

        this._dragState = {
            state: "snap",
            piece,
            location: square,
            source: square
        };

        // Wait for a paint
        this.requestUpdate();
        await new Promise((resolve) => setTimeout(resolve, 0));

        return new Promise<void>((resolve) => {
            const transitionComplete = () => {
                if (this._draggedPieceElement) {
                    this._draggedPieceElement.removeEventListener("transitionend", transitionComplete);
                }
                resolve();

                // Fire the snap-end event
                this.dispatchEvent(
                    new CustomEvent("snap-end", {
                        bubbles: true,
                        detail: {
                            source,
                            square,
                            piece
                        }
                    })
                );
            };
            if (this._draggedPieceElement) {
                this._draggedPieceElement.addEventListener("transitionend", transitionComplete);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Animations
    // -------------------------------------------------------------------------

    // calculate an array of animations that need to happen in order to get
    // from pos1 to pos2
    private _calculateAnimations(pos1: PositionObject, pos2: PositionObject): Animation[] {
        // make copies of both
        pos1 = deepCopy(pos1);
        pos2 = deepCopy(pos2);

        const animations: Animation[] = [];
        const squaresMovedTo: { [square: string]: boolean } = {};

        // remove pieces that are the same in both positions
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) continue;

            if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
                delete pos1[i];
                delete pos2[i];
            }
        }

        // find all the "move" animations
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) continue;

            const closestPiece = findClosestPiece(pos1, pos2[i]!, i);
            if (closestPiece) {
                animations.push({
                    type: "move",
                    source: closestPiece,
                    destination: i,
                    piece: pos2[i]!
                });

                delete pos1[closestPiece];
                delete pos2[i];
                squaresMovedTo[i] = true;
            }
        }

        // "add" animations
        for (const i in pos2) {
            if (!pos2.hasOwnProperty(i)) {
                continue;
            }

            animations.push({
                type: "add",
                square: i,
                piece: pos2[i]!
            });

            delete pos2[i];
        }

        // "clear" animations
        for (const i in pos1) {
            if (!pos1.hasOwnProperty(i)) continue;

            // do not clear a piece if it is on a square that is the result
            // of a "move", ie: a piece capture
            if (squaresMovedTo.hasOwnProperty(i)) continue;

            animations.push({
                type: "clear",
                square: i,
                piece: pos1[i]!
            });

            delete pos1[i];
        }

        return animations;
    }

    // execute an array of animations
    private async _doAnimations(animations: Animation[], oldPos: PositionObject, newPos: PositionObject) {
        if (animations.length === 0) {
            return;
        }

        let numFinished = 0;
        const transitionEndListener = () => {
            numFinished++;

            if (numFinished === animations.length) {
                document.removeEventListener("transitionend", transitionEndListener);
                this._animations.clear();
                this.requestUpdate();
                this.dispatchEvent(
                    new CustomEvent("move-end", {
                        bubbles: true,
                        detail: {
                            oldPosition: deepCopy(oldPos),
                            newPosition: deepCopy(newPos)
                        }
                    })
                );
            }
        };
        document.addEventListener("transitionend", transitionEndListener);

        // Render once with added pieces at opacity 0
        this._animations.clear();
        for (const animation of animations) {
            if (animation.type === "add" || animation.type === "add-start") {
                this._animations.set(animation.square, {
                    ...animation,
                    type: "add-start"
                });
            } else if (animation.type === "move" || animation.type === "move-start") {
                this._animations.set(animation.destination, {
                    ...animation,
                    type: "move-start"
                });
            } else {
                this._animations.set(animation.square, animation);
            }
        }

        // Wait for a paint
        this.requestUpdate();
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Render again with the piece at opacity 1 with a transition
        this._animations.clear();
        for (const animation of animations) {
            if (animation.type === "move" || animation.type === "move-start") {
                this._animations.set(animation.destination, animation);
            } else {
                this._animations.set(animation.square, animation);
            }
        }
        this.requestUpdate();
    }

    // -------------------------------------------------------------------------
    // Validation / Errors
    // -------------------------------------------------------------------------

    private _error(code: number, msg: string, _obj?: unknown) {
        const errorText = `Chessboard Error ${code} : ${msg}`;
        this.dispatchEvent(
            new ErrorEvent("error", {
                message: errorText
            })
        );
        return new Error(errorText);
    }
    requestUpdate(hint?: string): void {
        // TODO: Probably only needed for templated components.
        // console.lg(`requestUpdate(hint=${hint})`);
    }
    dispatchEvent(e: Event): void {
        this.ee.emit(e);
    }
}
