import { enableProdMode } from "@angular/core";

import { bootstrapApplication } from "@angular/platform-browser";
import { AppComponent } from "./app/app.component";
import { environment } from "./environments/environment";

if (environment.production) {
    enableProdMode();
}

bootstrapApplication(AppComponent, { providers: [] }).catch((err) => console.error(err));

// Inform the preload script that the application has been loaded.
postMessage({ payload: "removeLoading" }, "*");
