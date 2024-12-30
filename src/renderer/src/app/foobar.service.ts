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
            baz(name: string): Promise<number>;
            onGameClear(callback: () => void): void;
            onGameSetup(callback: () => void): void;
            onGamePlay(callback: () => void): void;
            onNewGameClassic(callback: () => void): void;
            onBoardFlip(callback: () => void): void;
            onEngineChange(callback: (filename: string) => void): void;
        };
    }
}

@Injectable({
    providedIn: "root"
})
export class FoobarService {
    constructor() {}

    baz(name: string): Promise<number> {
        return window.foobar.baz(name);
    }

    onGameClear(callback: () => void): void {
        window.foobar.onGameClear(callback);
    }

    onGameSetup(callback: () => void): void {
        window.foobar.onGameSetup(callback);
    }

    onGamePlay(callback: () => void): void {
        window.foobar.onGamePlay(callback);
    }

    onNewGameClassic(callback: () => void): void {
        window.foobar.onNewGameClassic(callback);
    }

    onBoardFlip(callback: () => void): void {
        window.foobar.onBoardFlip(callback);
    }

    onEngineChange(callback: (filename: string) => void): void {
        window.foobar.onEngineChange(callback);
    }
}
