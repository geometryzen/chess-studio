import { Piece, PositionObject } from "./chess-utils";

/**
 * Copies the source position to the target without clearing the source position.
 */
export function copy_position_source_target(source: Readonly<PositionObject>, target: PositionObject): void {
    for (const square of Object.keys(source)) {
        target[square] = source[square] as Piece;
    }
}
