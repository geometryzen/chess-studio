# chess-studio

## Continuous Integration
![CI](https://github.com/geometryzen/chess-studio/workflows/CI/badge.svg)

[Builds](https://github.com/geometryzen/chess-studio/actions)

## Getting started

```bash
$ git clone https://github.com/geometryzen/chess-studio
$ cd chess-studio
$ npm install --force
$ npm run build:dev:all
$ npm start
```

## Logging using electron-log

The default Electron log locations are:

on Linux: ~/.config/{app name}/logs/main.log
on macOS: ~/Library/Logs/{app name}/main.log
on Windows: %USERPROFILE%\AppData\Roaming\{app name}\logs\main.log
Reference: https://www.npmjs.com/package/electron-log

