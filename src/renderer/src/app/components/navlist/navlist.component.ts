import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatListItem, MatNavList } from "@angular/material/list";
import { RouterModule } from "@angular/router";

@Component({
    selector: "app-navlist",
    templateUrl: "./navlist.component.html",
    styleUrls: ["./navlist.component.scss"],
    imports: [MatIconModule, MatListItem, MatNavList, RouterModule],
    standalone: true
})
export class NavlistComponent implements OnInit {
    @Output() sidenavClose = new EventEmitter();

    constructor() { }

    ngOnInit() { }

    public onSidenavClose = () => {
        this.sidenavClose.emit();
    };
}
