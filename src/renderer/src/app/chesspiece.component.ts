import { Component, Input, NO_ERRORS_SCHEMA, OnDestroy, OnInit } from "@angular/core";

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
    set piece(piece: string) { this.#piece = piece; }
    #piece = "";
    ngOnInit(): void {
        // console.lg("ChessPiece.ngOnInit");
    }
    ngOnDestroy(): void {
        // console.lg("ChessPiece.ngOnDestroy");
    }
}
