import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from "@angular/core";
import "chessboard-element";
import { ChessBoardElement, fenToObj } from "chessboard-element";

interface ChessBoardMethods extends Pick<ChessBoardElement, "clear" | "fen" | "flip" | "hideNotation" | "move" | "resize" | "setPosition" | "start"> {

}

@Component({
    selector: "app-chessboard",
    templateUrl: "./chessboard.component.html",
    styleUrls: ["./chessboard.component.scss"],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
    standalone: true
})
export class ChessboardComponent implements OnInit {
    // @ViewChild('board') board: ComponentRef<ChessBoardElement>;
    constructor(
    ) {

    }

    async ngOnInit() {
        console.log("chessboard")
    }

    async flip(): Promise<void> {
        await window.customElements.whenDefined("chess-board")
        const board = document.getElementById("board") as unknown as ChessBoardMethods;
        console.log("chess-board is defined")
        board.flip()
    }
    async clear(): Promise<void> {
        await window.customElements.whenDefined("chess-board")
        const board = document.getElementById("board") as unknown as ChessBoardMethods;
        console.log("chess-board is defined")
        board.clear()
    }
    async reset(): Promise<void> {
        await window.customElements.whenDefined("chess-board")
        const board = document.getElementById("board") as unknown as ChessBoardMethods;
        console.log("chess-board is defined")
        const position = fenToObj("");
        board.setPosition("start", true);
        board.hideNotation = true;
        console.log(board.fen())
    }
}
