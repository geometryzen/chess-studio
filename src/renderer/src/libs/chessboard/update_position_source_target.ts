import { PositionObject } from "./chess-utils";
import { clear_position } from "./clear_position";
import { copy_position_source_target } from "./copy_position_source_target";

/**
 * Clears the target position then overlays then copies the source position to the target.
 */
export function update_position_source_target(source: Readonly<PositionObject>, target: PositionObject): void {
    clear_position(target);
    copy_position_source_target(source, target);
}
