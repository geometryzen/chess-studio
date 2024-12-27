import { Injectable } from "@angular/core";

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

@Injectable({
    providedIn: "root"
})
export class FoobarService {
    constructor() { }

    baz(name: string): Promise<number> {
        return window.foobar.baz(name)
    }
}
