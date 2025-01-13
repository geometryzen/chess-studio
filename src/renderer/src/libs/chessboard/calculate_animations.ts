import { findClosestPiece, Piece, PositionObject } from "./chess-utils";
import { copy_position } from "./copy_position";

export type Animation =
    | {
        type: "move";
        source: string;
        target: string;
        piece: string;
        square?: undefined;
    }
    | {
        type: "move-start";
        source: string;
        target: string;
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
        piece: Piece;
    }
    | {
        type: "add-start";
        square: string;
        piece: string;
    };

function remove_pieces_that_are_the_same_in_both_positions(pos1: PositionObject, pos2: PositionObject): void {
    for (const i in pos2) {
        if (!pos2.hasOwnProperty(i)) continue;

        if (pos1.hasOwnProperty(i) && pos1[i] === pos2[i]) {
            delete pos1[i];
            delete pos2[i];
        }
    }
}

export function calculateAnimations(starting_position: Readonly<PositionObject>, ending_position: Readonly<PositionObject>): Animation[] {
    const startPos = copy_position(starting_position);
    const endPos = copy_position(ending_position);

    const animations: Animation[] = [];
    const squaresMovedTo: { [square: string]: boolean } = {};

    remove_pieces_that_are_the_same_in_both_positions(startPos, endPos);

    // find all the "move" animations
    for (const i in endPos) {
        // Look for a piece, it must be there as the result of a move
        if (!endPos.hasOwnProperty(i)) continue;

        const closestPiece = findClosestPiece(startPos, endPos[i]!, i);
        if (closestPiece) {
            animations.push({
                type: "move",
                source: closestPiece,
                target: i,
                piece: endPos[i]!
            });

            delete startPos[closestPiece];
            delete endPos[i];
            squaresMovedTo[i] = true;
        }
    }

    // "add" animations
    for (const i in endPos) {
        if (!endPos.hasOwnProperty(i)) {
            continue;
        }

        animations.push({
            type: "add",
            square: i,
            piece: endPos[i]!
        });

        delete endPos[i];
    }

    // "clear" animations
    for (const i in startPos) {
        if (!startPos.hasOwnProperty(i)) continue;

        // do not clear a piece if it is on a square that is the result
        // of a "move", ie: a piece capture
        if (squaresMovedTo.hasOwnProperty(i)) continue;

        animations.push({
            type: "clear",
            square: i,
            piece: startPos[i]!
        });

        delete startPos[i];
    }

    return animations;
}
