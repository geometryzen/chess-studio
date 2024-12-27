import { ChildProcess, spawn } from "child_process";
import { EventEmitter } from "events";
import { EOL } from "os";
import * as path from "path";
import { fromEvent, Observable } from "rxjs";

import debug from "debug";

import { REGEX } from "./const";
import { goCommand, GoOptions } from "./goCommand";
import { goReducer } from "./goReducer";
import { initReducer, InitResult } from "./initReducer";
import { BestMove, parseBestmove } from "./parseBestmove";
import { Info, parseInfo } from "./parseInfo";
import { UciOption } from "./parseOption";

interface StringKeyedObject {
    [key: string]: any;
}

interface TypeSafeEventEmitter<C extends StringKeyedObject> extends EventEmitter {
    // K has to be a key on C (the passed type) but it also has to be a string and then we use index
    // types to get the actual type that we expect (C[K]).

    addListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    on<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    once<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    removeListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    off<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    removeAllListeners<K extends Extract<keyof C, string>>(eventName?: K): this;
    setMaxListeners(n: number): this;
    getMaxListeners(): number;
    listeners<K extends Extract<keyof C, string>>(eventName: K): Function[];
    rawListeners<K extends Extract<keyof C, string>>(eventName: K): Function[];
    emit<K extends Extract<keyof C, string>>(eventName: K, arg: C[K]): boolean;
    listenerCount<K extends Extract<keyof C, string>>(eventName: K): number;
    prependListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
    prependOnceListener<K extends Extract<keyof C, string>>(eventName: K, listener: (arg: C[K]) => void): this;
}
// See...
// https://page.mi.fu-berlin.de/block/uci.htm
// https://gist.github.com/DOBRO/2592c6dad754ba67e6dcaec8c90165bf
// https://www.chessprogramming.org/UCI

const log = debug("uci:Engine");
const engineLog = debug("uci:Engine:log");

function fromEngineLog(lines: unknown): void {
    engineLog("->", `${EOL}${lines}${EOL}`);
}

type Events = {
    info: Info;
    bestmove: BestMove;
    stop: {};
};

export async function example() {
    const engine = new Engine();
    await engine.hydrate("path/to/engine");
    await engine.setoption("MultiPV", "4");
    await engine.isready();
    engine.position("startpos", ["e2e4", "e7e5"]);
    engine.info$.subscribe(function (info: Info) { });
    engine.bestmove$.subscribe(function (bestmove: BestMove) { });
    engine.go({ depth: 4 });
    setTimeout(async () => {
        const bestmove = await engine.stop();
        bestmove.bestmove;
        await engine.dehydrate();
    }, 5000);
}

/**
 * Engine is a UCI interface between an engine executable (that understands UCI)
 * and itself. It abstracts away communication to the engine process by providing methods
 * for sending commands and mechanisms for parsing responses.
 *
 * It also has a chainable api ({@link EngineChain}) that allows for terse coding.
 *
 * Implements everything in the UCI protocol except debug and registration.
 *
 * ##### commands to engine
 * - ✓ uciimport { REGEX } from '../const'

 export default function parseOption(line) {
   const parsed = REGEX.option.exec(line)
   if (!parsed) return null

   const option = {
     type: parsed[2],
   }

   switch (parsed[2]) {
     case 'check':
       option.default = parsed[3] === 'true'
       break
     case 'spin':
       option.default = parseInt(parsed[3])
       option.min = parseInt(parsed[4])
       option.max = parseInt(parsed[5])
       break
     case 'combo':
       option.default = parsed[3]
       option.options = parsed[6].split(/ ?var ?/g)
       break //combo breaker?
     case 'string':
       option.default = parsed[3]
       break
     case 'button':
       //no other info
       break
   }

   return {
     [parsed[1]]: option,
   }
 }
 * - ✗ debug
 * - ✓ isready
 * - ✓ setoption
 * - ✗ register
 * - ✓ ucinewgame
 * - ✓ position
 * - ✓ go
 * - ✓ stop
 * - ✓ ponderhit
 * - ✓ quit
 *
 * ##### responses from engine
 * - ✓ id
 * - ✓ uciok
 * - ✓ readyok
 * - ✓ bestmove [ ponder]
 * - ✗ copyprotection
 * - ✗ registration
 * - ✓ info
 * - ✓ option
 * @param {string} filePath - absolute path to engine executable
 * @example
 * const enginePath = '/some/place/here'
 * //async/await
 * const engine = new Engine(enginePath)
 * await engine.init()
 * await engine.setoption('MultiPV', '4')
 * await engine.isready()
 * console.lg('engine ready', engine.id, engine.options)
 * const result = await engine.go({depth: 4})
 * console.lg('result', result)
 * await engine.quit()
 */
export class Engine {
    id: { name: string | null; author: string | null };
    readonly options: Map<string, UciOption> = new Map();
    exe?: ChildProcess;
    private readonly emitter: TypeSafeEventEmitter<Events> = new EventEmitter();
    readonly info$: Observable<Info> = fromEvent(this.emitter, "info") as Observable<Info>;
    readonly bestmove$: Observable<BestMove> = fromEvent(this.emitter, "bestmove") as Observable<BestMove>;
    /**
     * Create a new Engine instance. At first the Engine is uninitialized;
     * engine id and options are empty. It must be {@link #Engine#init}'ed.
     * @return new {@link Engine} instance
     * @example
     * const engine = new Engine('/Users/derp/stockfish-64')
     * console.lg(typeof engine)
     * // -> Engine
     */
    constructor() {
        this.id = {
            name: null,
            author: null
        };
        this.exe = void 0;
    }

    /**
     * Retireve the proc buffer until condition is true.
     * You shouldn't need to use this normally.
     * @param condition a function that returns true at some point
     * @return array of strings containing buffer received from engine
     * @example
     * //async/await
     * const lines = await myEngine.getBufferUntil(line => line === 'uciok')
     *
     * //promise
     * myEngine.getBufferUntil(function(line) {
     *   return line === 'uciok'
     * })
     * .then(function(lines) {
     *   console.lg('engine says', lines)
     * })
     */
    async getBufferUntil(condition: (line: string) => boolean): Promise<string[]> {
        const lines: string[] = [];
        let listener: (data: string) => void = function () { };
        let reject_ref: (reason?: any) => void = function () { };
        const p = new Promise<void>((resolve, reject) => {
            reject_ref = reject;
            let backlog = "";
            //listener gets new lines until condition is true
            listener = (data: string) => {
                backlog += data;

                let n = backlog.indexOf("\n");
                while (n > -1) {
                    lines.push(backlog.substring(0, n).trim());
                    backlog = backlog.substring(n + 1);
                    n = backlog.indexOf("\n");
                }

                if (condition(lines[lines.length - 1])) {
                    resolve();
                    return;
                }
                if (condition(backlog)) {
                    lines.push(backlog);
                    return resolve();
                }
            };
            if (this.exe) {
                if (this.exe.stdout) {
                    this.exe.stdout.on("data", listener);
                }
                //reject if something goes wrong during buffering
                this.exe.once("error", reject);
                this.exe.once("close", reject);
            }
        });
        await p;
        //cleanup
        if (this.exe) {
            if (this.exe.stdout) {
                this.exe.stdout.removeListener("data", listener);
            }
            this.exe.removeListener("error", reject_ref);
            this.exe.removeListener("close", reject_ref);
        }
        return lines;
    }

    write(command: string): void {
        if (this.exe) {
            if (this.exe.stdin) {
                this.exe.stdin.write(`${command}${EOL}`);
            }
        }
        // console.lg("<-", command, EOL);
    }

    async hydrate(filePath: string): Promise<this> {
        if (this.exe) throw new Error('cannot call "init()": already initialized');
        this.exe = spawn(path.normalize(filePath));
        if (this.exe.stdout) {
            this.exe.stdout.setEncoding("utf8");
            this.exe.stdout.on("data", fromEngineLog);
        }
        this.write("uci");
        const lines = await this.getBufferUntil((line) => line === "uciok");
        const { id, options } = lines.reduce(initReducer, {
            id: {},
            options: {}
        } as InitResult);
        if (id) this.id = id;
        if (options) {
            const keys = Object.keys(options);
            keys.forEach((key) => {
                const value = options[key];
                this.options.set(key, value);
            });
        }
        return this;
    }

    async dehydrate(): Promise<this> {
        if (this.exe) {
            //send quit cmd and resolve when closed
            await new Promise((resolve) => {
                if (this.exe) {
                    this.exe.on("close", resolve);
                }
                this.write("quit");
            });
            //cleanup
            if (this.exe) {
                if (this.exe.stdout) {
                    this.exe.stdout.removeListener("data", fromEngineLog);
                }
                this.exe.removeAllListeners();
                delete this.exe;
            }
            return this;
        }
        else {
            return this;
        }
    }

    /**
     * Sends UCI `isready` command to the engine. Promise resolves after `readyok` is received.
     * @return {promise<Engine>} itself (the Engine instance)
     * @throws {Error} if Engine process is not running
     */
    async isready(): Promise<this> {
        if (!this.exe) throw new Error('cannot call "isready()": engine process not running');
        //send isready and wait for the response
        this.write("isready");
        await this.getBufferUntil((line) => line === "readyok");
        return this;
    }

    /**
     * Sends a command to engine process. Promise resolves after `readyok` is received.
     * Some commands in the UCI protocol do not require responses (like `setoption`).
     * So, to be sure, {@link Engine#isready} is invoked to determine when it's safe to continue.
     * @param cmd command to send to the engine process
     * @return {promise<Engine>} itself (the Engine instance)
     * @throws {Error} if engine process is not running
     */
    async sendCmd(cmd: string): Promise<this> {
        if (!this.exe) throw new Error(`cannot call "${cmd}()": engine process not running`);
        //send cmd to engine
        log("sendCmd", cmd);
        this.write(`${cmd}`);
        //return after ready - avoids pitfalls for commands
        //that dont return a response
        return this.isready();
    }

    async setoption(name: string, value?: string): Promise<this> {
        //construct command
        let cmd = `name ${name}`;
        if (typeof value !== "undefined") cmd += ` value ${value.toString()}`;
        //send and wait for response
        await this.sendCmd(`setoption ${cmd}`);
        // this.options.set(name, value);
        return this;
    }

    /**
     * Sends `ucinewgame` command to engine process.
     * @return {promise<Engine>} itself (the Engine instance)
     * @throws {Error} if engine process is not running
     */
    async ucinewgame(): Promise<this> {
        return this.sendCmd("ucinewgame");
    }

    /**
     * Sends `ponderhit` command to engine process.
     * @return {promise<Engine>} itself (the Engine instance)
     * @throws {Error} if engine process is not running
     */
    async ponderhit(): Promise<this> {
        return this.sendCmd("ponderhit");
    }

    /**
     * Sends `position` command to engine process.
     * Does not validate inputs.
     * @param fen - can be `startpos` for start position, or `fen ...` for
     * setting position via FEN
     * @param moves - moves (in engine notation) to append to the command
     * @return {promise<Engine>} itself (the Engine instance)
     * @throws {Error} if engine process is not running
     */
    async position(fen: string | "startpos", moves: string[]): Promise<this> {
        //can be startpos or fen string
        let cmd;
        if (fen === "startpos") {
            cmd = "startpos";
        } else {
            cmd = `fen ${fen}`;
        }
        //add moves if provided
        if (moves && moves.length) {
            const movesStr = moves.join(" ");
            cmd += ` moves ${movesStr}`;
        }
        //send to engine
        return this.sendCmd(`position ${cmd}`);
    }

    /**
     * Special case of {@link #Engine#go} with `infinite` search enabled.
     * @param {object} options - options for search. see {@link #Engine#go} for details
     * @return {EventEmitter} an EventEmitter that will emit `data` events with either
     * `bestmove` string or `info` objects. {@link #Engine#stop} must be used to stop
     * the search and receive the bestmove.
     * @throws {Error} if engine process is not running
     * @example
     * //async/await
     * const engine = new Engine(enginePath)
     * await engine.init()
     * await engine.isready()
     * await engine.setoption('MultiPV', '3')
     * const emitter = engine.goInfinite()
     * emitter.on('data', a => {
     *   console.lg('data', a)
     * })
     * setTimeout(async () => {
     *   const bestmove = await engine.stop()
     *   console.lg('bestmove', bestmove)
     *   await engine.quit()
     * }, 5000)
     */
    go(options: GoOptions = {}): void {
        if (!this.exe) throw new Error('cannot call "goInfinite()": engine process not running');

        const stdoutListener = (buffer: string) => {
            buffer
                .split(/\r?\n/g)
                .filter((line) => !!line.length)
                .forEach((line) => {
                    const info = parseInfo(line);
                    if (info) return this.emitter.emit("info", info);
                    const bestmove = parseBestmove(line);
                    if (bestmove) return this.emitter.emit("bestmove", bestmove);
                });
        };
        // options.infinite = true;
        const command = goCommand(options);
        if (this.exe) {
            if (this.exe.stdout) {
                this.exe.stdout.on("data", stdoutListener);
            }
            // TODO: I don't like reusing the emitter for this.
            this.emitter.on("stop", () => {
                if (this.exe?.stdout) {
                    this.exe.stdout.removeListener("data", stdoutListener);
                }
            });
        }
        this.write(command);
    }

    /**
     * Sends `stop` command to the engine, for stopping an ongoing search. Engine will
     * reply with the `bestmove`, which is returned, along with any other `info` lines.
     * See {@link #Engine#goInfinite} for usage example.
     * @return {promise<{bestmove: string, info: string[]}>} result - See {@link #Engine#go}
     *
     */
    async stop(): Promise<BestMove> {
        if (!this.emitter) throw new Error('cannot call "stop()": goInfinite() is not in progress');
        //send the stop message & end goInfinite() listener
        this.write("stop");
        this.emitter.emit("stop", {});
        //same idea as go(), only we expect just bestmove line here
        const lines = await this.getBufferUntil((line) => REGEX.bestmove.test(line));
        const result = lines.reduce(goReducer, {
            bestmove: null,
            info: []
        } as BestMove);
        return result;
    }
}
