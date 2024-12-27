import { enableProdMode } from "@angular/core";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";

import { AppModule } from "./app/app.module";
import { environment } from "./environments/environment";

if (environment.production) {
    enableProdMode();
}

// TODO: This is what you normally do for modules.
// We can change this for standalone components.
platformBrowserDynamic()
    .bootstrapModule(AppModule)
    .catch((err) => console.error(err));
