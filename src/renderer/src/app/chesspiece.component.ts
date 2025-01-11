import { booleanAttribute, Component, Input, OnDestroy, OnInit } from "@angular/core";

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
    @Input({ alias: "left" }) left: string | undefined;
    @Input({ alias: "top" }) top: string | undefined;
    @Input({ alias: "width" }) width: string | undefined;
    @Input({ alias: "height" }) height: string | undefined;
    ngOnInit(): void {
        // console.lg(`ChessPiece.ngOnInit piece=${this.piece}`);
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
