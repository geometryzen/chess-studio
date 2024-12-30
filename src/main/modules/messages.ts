"use strict";

import { filename as configFilename } from "./config_io.js";
import { filename as engineFilename } from "./engineconfig_io.js";

export const about_versus_mode = `The "play this colour" option causes Leela to \
evaluate one side of the position only. The top move is automatically played on \
the board upon reaching the node limit (see the Engine menu). This allows you to \
play against Leela.

The "self-play" option causes Leela to play itself.

Higher temperature makes the moves less predictable, but at some cost to move \
correctness. Meanwhile, TempDecayMoves specifies how many moves the temperature \
effect lasts for. These settings have no effect on analysis, only actual move \
generation.`;

export const save_not_enabled = `Save is disabled until you read the following \
warning.

ChessStudio does not append to PGN files, nor does it save collections. It only \
writes the current game to file. When you try to save, you will be prompted with \
a standard "Save As" dialog. If you save to a file that already exists, that \
file will be DESTROYED and REPLACED with a file containing only the current \
game.

You can enable save in the dev menu.`;

export const engine_not_present = `Engine not found. Please find the engine via the \
Engine menu. You might also need to locate the weights (neural network) file.`;

export const engine_failed_to_start = `Engine failed to start.`;

export const uncaught_exception = `There may have been an uncaught exception. If you \
could open the dev tools and the console tab therein, and report the contents to \
the author (ideally with a screenshot) that would be grand.`;

export const renderer_crash = `The renderer process has crashed. Experience suggests \
this happens when Leela runs out of RAM. If this doesn't apply, please tell the \
author how you made it happen.`;

export const renderer_hang = `The renderer process may have hung. Please tell the \
author how you made this happen.`;

export const about_sizes = `You can get more fine-grained control of font, board, \
graph, and window sizes via ChessStudio's config file (which can be found via the \
Dev menu).`;

export const about_hashes = `You can set the Hash value directly via ChessStudio's \
${engineFilename} file (which can be found via the Dev menu).`;

export const thread_warning = `Note that, for systems using a GPU, 2 threads is usually \
sufficient for Leela, and increasing this number can actually make Leela weaker! \
More threads should probably only be used on CPU-only systems, if at all.

If no tick is present in this menu, the default is being used, which is probably \
what you want.`;

export const adding_scripts = `ChessStudio has a scripts folder, inside which you can \
place scripts of raw input to send to the engine. A small example file is \
provided. This is for advanced users and devs who understand the UCI protocol.

Note that this is for configuration only.`;

export const invalid_script = `Bad script; scripts are for configuration only.`;

export const wrong_engine_exe = `That is almost certainly the wrong file. What we \
need is likely to be called lc0.exe or lc0.`;

export const send_fail = `Sending to the engine failed. This usually means it has \
crashed.`;

export const invalid_pieces_directory = `Did not find all pieces required!`;

export const about_custom_pieces = `To use a custom piece set, select a folder \
containing SVG or PNG files with names such as "Q.png" (or "Q.svg") for white \
and "_Q.png" (or "_Q.svg") for black.`;

export const desync = `Desync... (restart engine via Engine menu)`;

export const c960_warning = `We appear to have entered a game of Chess960, however \
this engine does not support Chess960. Who knows what will happen. Probably not \
good things. Maybe bad things.`;

export const bad_bin_book = `This book contained unsorted keys and is therefore not a \
valid Polyglot book.`;

export const file_too_big = `Sorry, this file is probably too large to be safely \
loaded in ChessStudio. If you want, you can suppress this warning in the Dev menu, \
and try to load the file anyway.`;

export const pgn_book_too_big = `This file is impractically large for a PGN book - \
consider converting it to Polyglot (.bin) format. If you want, you can suppress \
this warning in the Dev menu, and try to load the file anyway.`;

export const engine_options_reset = `As of v1.0.0, ChessStudio will store engine options \
separately for each engine. To facilite this, your engine options have been \
reset. If you were using special (hand-edited) options, they are still present \
in your ${configFilename} file, and can be manually moved to \
${engineFilename}.`;

export const too_soon_to_set_options = `Please wait till the engine has loaded before \
setting options.`;
