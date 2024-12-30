import { Engine } from "./engine/Engine";
import { BestMove } from "./engine/parseBestmove";
import { Info } from "./engine/parseInfo";
import { MenuHandler } from "./menu/menu";
import { Config, load, save } from "./modules/config_io";

export class Controller implements MenuHandler {
    readonly engine = new Engine();
    readonly config: Config = new Config();

    constructor() {
        this.config = load();
        console.log(`${JSON.stringify(this.config)}`);
    }

    getEngineFolder(): string {
        return this.config.engine_dialog_folder;
    }

    setEngineFolder(engineFolder: string): void {
        this.config.engine_dialog_folder = engineFolder;
        save(this.config);
    }

    async restart_engine(): Promise<void> {
        if (this.config.path) {
            this.switch_engine(this.config.path);
        }
    }

    async switch_engine(filePath: string): Promise<void> {
        try {
            await this.engine.dehydrate();
            await this.engine.hydrate(filePath);

            console.log(JSON.stringify(this.engine.id));
            // The options aren't so easy to see because they are a map.
            console.log(JSON.stringify(Object.keys(this.engine.options)));

            this.config.path = filePath;
            save(this.config);

            console.log("setoption");
            // await this.engine.setoption("MultiPV", "4");
            console.log("isready");
            await this.engine.isready();
            // console.log("position");
            // await this.engine.position("startpos", []);
            const subInfo = this.engine.info$.subscribe(function (info: Info) {
                // console.log(`info => ${JSON.stringify(info)}`)
            });
            const subMove = this.engine.bestmove$.subscribe(function (bestmove: BestMove) {
                // console.log(`bestomve => ${JSON.stringify(bestmove)}`)
            });
            // console.log("go");
            // this.engine.go({ infinite: true });
            /*
            setTimeout(async () => {
                console.log("stop");
                const stopped = await this.engine.stop();
                stopped.bestmove;
                subInfo.unsubscribe();
                subMove.unsubscribe();
                console.log(`stopped ${JSON.stringify(stopped)}`);
                // await engine.dehydrate();
            }, 5000);
            */
        } catch (e) {
            console.error(`onChangeEngine(${filePath}). Cause: ${e}`);
        }
    }
}
