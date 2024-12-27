import { Component, OnInit } from "@angular/core";
import { FoobarService } from "./foobar.service";
import { IpcService } from "./ipc.service";

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
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    standalone: false
})
export class AppComponent implements OnInit {
    title = "Chess Studio";

    constructor(
        private ipcService: IpcService,
        private foobarService: FoobarService
    ) {}

    async ngOnInit(): Promise<void> {
        const n = await window.foobar.baz("World");
        console.log(`baz("World") => ${n}`);

        const m = this.foobarService.baz("Wow!");
        console.log(`foobar.baz("Wow!!!") => ${n}`);
    }

    clickDevTools() {
        this.ipcService.openDevTools();
    }
}
