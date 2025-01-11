import { PositionObject } from "./chess-utils";

/**
 * Mutates the target by removing all the entries.
 */
export function clear_position(target: PositionObject): void {
    for (const square of Object.keys(target)) {
        delete target[square];
    }
}
