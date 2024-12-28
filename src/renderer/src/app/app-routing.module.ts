import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { ChessboardComponent } from "./components/chessboard/chessboard.component";

const routes: Routes = [
    { path: "", component: ChessboardComponent }
    //  { path: '404', component: NotfoundComponent },
    //  { path: '**', redirectTo: '/404' }
];

@NgModule({
    imports: [RouterModule.forRoot(routes)],
    exports: [RouterModule]
})
export class AppRoutingModule {}
