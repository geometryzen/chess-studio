import { App } from "electron";
import { join } from "path";
import { Engine } from "./engine/Engine";
import { MenuHandler } from "./menu/menu";
import { Config, load, save } from "./modules/config_io";

export class Controller implements MenuHandler {
    readonly engine = new Engine();
    readonly config: Config;
    readonly configPath: string;

    constructor(app: App) {
        const userDataPath = app.getPath("userData");
        this.configPath = join(userDataPath, "config.json");
        this.config = load(this.configPath);
    }

    getEngineFolder(): string | undefined {
        return this.config.engineFolder;
    }

    setEngineFolder(engineFolder: string): void {
        this.config.engineFolder = engineFolder;
        save(this.configPath, this.config);
    }

    async restart_engine(): Promise<void> {
        if (this.config.engineFilename) {
            this.switch_engine(this.config.engineFilename);
        } else {
        }
    }

    async switch_engine(filePath: string): Promise<void> {
        try {
            await this.engine.dehydrate();
            await this.engine.hydrate(filePath);

            this.config.engineFilename = filePath;
            save(this.configPath, this.config);

            // await this.engine.setoption("MultiPV", "4");
            await this.engine.isready();
        } catch (e) {
            console.error(`onChangeEngine(${filePath}). Cause: ${e}`);
        }
    }
}
