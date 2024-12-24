import { Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { c960_fen } from "../libs/chess960.js";
import { LoadFEN } from "../libs/fen.js";
import { NewRoot, Node } from "../libs/Node.js";
import { perft } from "../libs/perft.js";
import { Position } from "../libs/Position.js";
import { Table } from "../libs/Table.js";

// The following TypeScript definitions have the same effect.

/*
declare global {
    namespace foobar {
        function baz(name: string): Promise<number>;
    }
}
*/
/*
export interface IElectronAPI {
    baz: (name: string) => Promise<number>,
}

declare global {
    interface Window {
        foobar: IElectronAPI
    }
}
*/
declare global {
    interface Window {
        foobar: {
            baz: (name: string) => Promise<number>;
        };
    }
}

@Component({
    selector: "app-root",
    imports: [RouterOutlet],
    templateUrl: "./app.component.html",
    styleUrl: "./app.component.scss"
})
export class AppComponent implements OnInit {
    title = "ChessStudio";
    position: Position = new Position();
    table: Table = new Table();
    root: Node;
    constructor() {
        this.root = NewRoot(this.position);
    }
    async ngOnInit(): Promise<void> {
        const n = await window.foobar.baz("World");
        console.log(`n=>${n}`);
        const fen = c960_fen(27);
        this.position = LoadFEN(fen);
        const moves = perft(this.position, 5, true);
        console.log(`${moves}`);
    }
}
