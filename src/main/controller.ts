import { App } from "electron";
import { join } from "path";
import { Engine } from "./engine/Engine";
import { BestMove } from "./engine/parseBestmove";
import { Info } from "./engine/parseInfo";
import { MenuHandler } from "./menu/menu";
import { Config, load, save } from "./modules/config_io";

export class Controller implements MenuHandler {
    readonly engine = new Engine();
    readonly config: Config;
    readonly configPath: string;

    constructor(app: App) {
        const userDataPath = app.getPath("userData")
        console.log(`userDataPath: ${userDataPath}`);
        this.configPath = join(userDataPath, "config.json");
        this.config = load(this.configPath);
        console.log(`config: ${JSON.stringify(this.config, null, 2)}`);
    }

    getEngineFolder(): string | undefined {
        return this.config.engineFolder;
    }

    setEngineFolder(engineFolder: string): void {
        this.config.engineFolder = engineFolder;
        console.log(`config: ${JSON.stringify(this.config, null, 2)}`);
        save(this.configPath, this.config);
    }

    async restart_engine(): Promise<void> {
        console.log(`Controller.restart_engine() path=${this.config.engineFilename}`)
        if (this.config.engineFilename) {
            this.switch_engine(this.config.engineFilename);
        }
        else {

        }
    }

    async switch_engine(filePath: string): Promise<void> {
        try {
            await this.engine.dehydrate();
            await this.engine.hydrate(filePath);

            console.log(JSON.stringify(this.engine.id));
            // The options aren't so easy to see because they are a map.
            console.log(JSON.stringify(Object.keys(this.engine.options)));

            this.config.engineFilename = filePath;
            console.log(`config: ${JSON.stringify(this.config, null, 2)}`);
            save(this.configPath, this.config);

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
