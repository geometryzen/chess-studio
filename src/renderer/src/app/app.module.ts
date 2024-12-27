import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { MaterialModule } from "./material.module";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./app.component";
import { Component1Component } from "./components/component1/component1.component";
import { Component2Component } from "./components/component2/component2.component";
import { NavlistComponent } from "./components/navlist/navlist.component";

@NgModule({
    declarations: [AppComponent, Component1Component],
    imports: [BrowserModule, AppRoutingModule, BrowserAnimationsModule, Component2Component, MaterialModule, NavlistComponent],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule { }
