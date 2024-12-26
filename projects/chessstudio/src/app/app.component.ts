import { Component, OnInit } from "@angular/core";
import { RouterOutlet } from "@angular/router";

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
    constructor() {
    }
    async ngOnInit(): Promise<void> {
        const n = await window.foobar.baz("World");
        console.log(`baz("World") => ${n}`);
    }
}
