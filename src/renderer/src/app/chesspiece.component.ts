import { booleanAttribute, Component, Input, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from "@angular/core";

function trimString(value: string | undefined): number {
    return 7;
}

@Component({
    selector: "chess-piece",
    templateUrl: "./chesspiece.component.html",
    styleUrls: ["./chesspiece.component.scss"],
    schemas: [NO_ERRORS_SCHEMA],
    standalone: true
})
export class ChessPiece implements OnInit, OnDestroy {
    @Input()
    get piece(): string {
        return this.#piece;
    }
    set piece(piece: string) {
        this.#piece = piece;
    }
    #piece = "";
    @Input({ alias: "dragged", transform: booleanAttribute }) dragged: boolean = false;
    @Input({ alias: "left" }) left: string | undefined;
    @Input({ alias: "top" }) top: string | undefined;
    @Input({ alias: "width" }) width: string | undefined;
    @Input({ alias: "height" }) height: string | undefined;
    ngOnInit(): void {
        // console.lg("ChessPiece.ngOnInit");
    }
    ngOnDestroy(): void {
        // console.lg("ChessPiece.ngOnDestroy");
    }
    style(): string {
        if (this.dragged) {
            const s = `opacity: 0.5; transition-duration: 0ms; display: block; position: absolute; left:${this.left}; top:${this.top}; width:${this.width}; height:${this.height};`;
            // console.lg(s);
            return s;
        } else {
            return "opacity: 1; transition-duration: 0ms;";
        }
    }
}
