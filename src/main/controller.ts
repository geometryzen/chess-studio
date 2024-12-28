import { Engine } from "./engine/Engine";
import { BestMove } from "./engine/parseBestmove";
import { Info } from "./engine/parseInfo";
import { MenuHandler } from "./menu/index";

export class Controller implements MenuHandler {
    readonly engine = new Engine();

    constructor() {}

    async onChangeEngine(filePath: string): Promise<void> {
        try {
            await this.engine.dehydrate();
            await this.engine.hydrate(filePath);
            console.log("setoption");
            await this.engine.setoption("MultiPV", "4");
            console.log("isready");
            await this.engine.isready();
            console.log("position");
            await this.engine.position("startpos", ["e2e4", "e7e5"]);
            const subInfo = this.engine.info$.subscribe(function (info: Info) {
                // console.log(`info => ${JSON.stringify(info)}`)
            });
            const subMove = this.engine.bestmove$.subscribe(function (bestmove: BestMove) {
                // console.log(`bestomve => ${JSON.stringify(bestmove)}`)
            });
            console.log("go");
            this.engine.go({ infinite: true });
            setTimeout(async () => {
                console.log("stop");
                const stopped = await this.engine.stop();
                stopped.bestmove;
                subInfo.unsubscribe();
                subMove.unsubscribe();
                console.log(`stopped ${JSON.stringify(stopped)}`);
                // await engine.dehydrate();
            }, 5000);
        } catch (e) {
            console.error(`onChangeEngine(${filePath}). Cause: ${e}`);
        }
    }
}
