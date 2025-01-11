import { Injectable, NgZone } from "@angular/core";
import { Observable } from "rxjs";

export interface MoveCandidate {
    depth: number;
    currmove: string;
    currmovenumber: number;
}

export interface MoveScore {
    depth: number;
    seldepth: number;
    time: number;
    nodes: number;
    hashfull: number;
    nps: number;
    tbhits: number;
    score: {
        unit: string;
        value: number;
    };
    multipv: number;
    pv: string;
}

export interface BestMove {
    bestmove: string;
    info: MoveScore[];
    ponder: string;
}

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
            go(fen: string): Promise<void>;
            halt(): Promise<BestMove>;
            onGameClear(callback: () => void): void;
            onGameSetup(callback: () => void): void;
            onGamePlay(callback: () => void): void;
            onNewGameClassic(callback: () => void): void;
            onTreeRoot(callback: () => void): void;
            onTreeEnd(callback: () => void): void;
            onTreeBackward(callback: () => void): void;
            onTreeForward(callback: () => void): void;
            onBoardFlip(callback: () => void): void;
            onEngineChange(callback: (filename: string) => void): void;
            onAnalysisGo(callback: () => void): void;
            onAnalysisHalt(callback: () => void): void;
            onAnalysisMoveScore(callback: (info: MoveScore) => void): void;
            onAnalysisMoveCandidate(callback: (info: MoveCandidate) => void): void;
        };
    }
}

//
// NgZone is used to ensure that the callback functions we register with the main thread are executed in the Angular zone.
// This is necessary to ensure that Angular change detection takes place, updating the user interface.
//
// Note that with callbacks, there is no unregister or unsubscribe equivalent.
// The use of Observable for callbacks at least hides that potential inside this service.
// This works assuming that the client unsubscribes.
//

@Injectable({
    providedIn: "root"
})
export class FoobarService {
    constructor(private ngZone: NgZone) { }

    go(fen: string): Promise<void> {
        return window.foobar.go(fen);
    }

    halt(): Promise<BestMove> {
        return window.foobar.halt();
    }

    get gameClear$(): Observable<void> {
        return new Observable<void>((subscriber) => {
            window.foobar.onGameClear(() => {
                this.ngZone.run(function () {
                    subscriber.next();
                    // subscriber.complete();
                });
            });
        });
    }
    get gameNew$(): Observable<void> {
        return new Observable<void>((subscriber) => {
            window.foobar.onNewGameClassic(() => {
                this.ngZone.run(function () {
                    subscriber.next();
                    // subscriber.complete();
                });
            });
        });
    }
    /*
    onGameClear(callback: () => void): void {
        window.foobar.onGameClear(callback);
    }
    */

    onGameSetup(callback: () => void): void {
        window.foobar.onGameSetup(callback);
    }

    onGamePlay(callback: () => void): void {
        window.foobar.onGamePlay(callback);
    }
    /*
    onNewGameClassic(callback: () => void): void {
        window.foobar.onNewGameClassic(callback);
    }
    */

    onTreeRoot(callback: () => void): void {
        window.foobar.onTreeRoot(callback);
    }

    onTreeEnd(callback: () => void): void {
        window.foobar.onTreeEnd(callback);
    }

    get treeBackward$(): Observable<void> {
        return new Observable<void>((subscriber) => {
            window.foobar.onTreeBackward(() => {
                this.ngZone.run(function () {
                    subscriber.next();
                    // subscriber.complete();
                });
            });
        });
    }

    onTreeBackward(callback: () => void): void {
        window.foobar.onTreeBackward(() => {
            this.ngZone.run(callback);
        });
    }

    onTreeForward(callback: () => void): void {
        window.foobar.onTreeForward(() => {
            this.ngZone.run(callback);
        });
    }

    onBoardFlip(callback: () => void): void {
        window.foobar.onBoardFlip(callback);
    }

    onEngineChange(callback: (filename: string) => void): void {
        window.foobar.onEngineChange(callback);
    }
    onAnalysisGo(callback: () => void): void {
        window.foobar.onAnalysisGo(callback);
    }

    onAnalysisHalt(callback: () => void): void {
        window.foobar.onAnalysisHalt(callback);
    }

    onAnalysisMoveScore(callback: (info: MoveScore) => void): void {
        window.foobar.onAnalysisMoveScore(callback);
    }
    onAnalysisMoveCandidate(callback: (info: MoveCandidate) => void): void {
        window.foobar.onAnalysisMoveCandidate(callback);
    }
}
