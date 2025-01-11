import { PositionObject } from "./chess-utils";

export function equal_positions(a: Readonly<PositionObject>, b: Readonly<PositionObject>): boolean {
    for (const square of Object.keys(a)) {
        if (a[square] !== b[square]) {
            return false;
        }
    }
    for (const square of Object.keys(b)) {
        if (a[square] !== b[square]) {
            return false;
        }
    }
    return true;
}

export function different_positions(a: Readonly<PositionObject>, b: Readonly<PositionObject>): boolean {
    return !equal_positions(a, b);
}
