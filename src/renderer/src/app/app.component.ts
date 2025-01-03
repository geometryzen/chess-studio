import { Component, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSidenavModule } from "@angular/material/sidenav";
import { MatToolbarModule } from "@angular/material/toolbar";
import { RouterModule } from "@angular/router";
import { IpcService } from "./ipc.service";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    imports: [MatButtonModule, MatIconModule, MatSidenavModule, MatToolbarModule, RouterModule],
    standalone: true
})
export class AppComponent implements OnInit {
    title = "Chess Studio";

    constructor(private ipcService: IpcService) {}

    async ngOnInit(): Promise<void> {}

    clickDevTools() {
        this.ipcService.openDevTools();
    }
}
