import { Component, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterModule } from "@angular/router";
import { NavlistComponent } from "./components/navlist/navlist.component";
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
    imports: [MatButtonModule, MatIconModule, MatSidenavModule, MatToolbarModule, NavlistComponent, RouterModule],
    standalone: true
})
export class AppComponent implements OnInit {
    title = "Chess Studio";

    constructor(
        private ipcService: IpcService,
        private foobarService: FoobarService
    ) { }

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
