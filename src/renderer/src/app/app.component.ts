import { Component } from "@angular/core";
import { IpcService } from "./ipc.service";

@Component({
    selector: "app-root",
    templateUrl: "./app.component.html",
    styleUrls: ["./app.component.scss"],
    standalone: false
})
export class AppComponent {
    title = "Chess Studio";

    constructor(private ipcService: IpcService) { }

    clickDevTools() {
        this.ipcService.openDevTools();
    }
}
