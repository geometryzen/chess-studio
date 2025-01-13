import { booleanAttribute, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from "@angular/core";

@Component({
    selector: "chess-piece",
    templateUrl: "./chesspiece.component.html",
    styleUrls: ["./chesspiece.component.scss"],
    // schemas: [NO_ERRORS_SCHEMA],
    standalone: true
})
export class ChessPiece implements OnInit, OnDestroy {
    @Input({ alias: "piece" }) piece: string | undefined;
    @Input({ alias: "dragged", transform: booleanAttribute }) dragged: boolean = false;
    @Input({ alias: "piece-styles" }) pieceStyles: Partial<CSSStyleDeclaration> | undefined;
    @Output("transitionend") transtionend$ = new EventEmitter<void>();
    ngOnInit(): void {
        // console.lg(`ChessPiece.ngOnInit piece=${this.piece} dragged=${this.dragged} pieceStyles=${JSON.stringify(this.pieceStyles)}`);
        // console.lg("style()", this.style());
    }
    ngOnDestroy(): void {
        // console.lg("ChessPiece.ngOnDestroy");
    }
    style(): string | null {
        if (this.pieceStyles) {
            const css = this.pieceStyles;
            const parts: { name: string; value: string }[] = [];
            if (css.opacity) {
                parts.push({ name: "opacity", value: css.opacity });
            }
            if (css.transitionProperty) {
                parts.push({ name: "transition-property", value: css.transitionProperty });
            }
            if (css.transitionDuration) {
                parts.push({ name: "transition-duration", value: css.transitionDuration });
            }

            if (css.display) {
                parts.push({ name: "display", value: css.display });
            }
            if (this.dragged) {
                parts.push({ name: "position", value: "absolute" });
            } else {
                if (css.position) {
                    parts.push({ name: "position", value: css.position });
                }
            }
            if (css.left) {
                parts.push({ name: "left", value: css.left });
            }
            if (css.top) {
                parts.push({ name: "top", value: css.top });
            }
            if (css.width) {
                parts.push({ name: "width", value: css.width });
            }
            if (css.height) {
                parts.push({ name: "height", value: css.height });
            }
            return parts.map((part) => `${part.name}: ${part.value};`).join(" ");
        } else {
            return null;
        }
    }
    on_transitionend(event: TransitionEvent): void {
        // TODO: Do we need this. i.e. does the event bubble up?
        this.transtionend$.emit();
    }
}
