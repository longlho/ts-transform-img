# ts-transform-img

[![Greenkeeper badge](https://badges.greenkeeper.io/longlho/ts-transform-img.svg)](https://greenkeeper.io/)

This is a TypeScript AST Transformer that allows you to write `import * as img from 'foo.png'`. Depending on file size, the img with be base64-inlined in the source and/or converted to a URL using the `generateFilePath` config

## Usage
First of all, you need some level of familiarity with the [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API).

`compile.ts` & tests should have examples of how this works. The available options are:

### `threshold?: number`
Threshold of img size that will be inlined, default to 10K

### `generateFilePath?(filePath: string): string;`
Function to generate URL for imgs that are above the threshold. `filePath` absolute path to img file from the import source file path