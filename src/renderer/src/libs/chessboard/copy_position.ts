import { Piece, PositionObject } from "./chess-utils";

export function copy_position(source: Readonly<PositionObject>): PositionObject {
    const retval: PositionObject = {};
    for (const square of Object.keys(source)) {
        retval[square] = source[square] as Piece;
    }
    return retval;
}
