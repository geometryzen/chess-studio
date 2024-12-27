import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ChessboardComponent } from "./components/chessboard/chessboard.component";
import { Component1Component } from "./components/component1/component1.component";
import { Component2Component } from "./components/component2/component2.component";

const routes: Routes = [
    { path: "", component: Component1Component },
    { path: "2", component: Component2Component },
    { path: "3", component: ChessboardComponent }
    //  { path: '404', component: NotfoundComponent },
    //  { path: '**', redirectTo: '/404' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule { }
