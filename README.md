# ts-transform-img

![build status](https://travis-ci.org/longlho/ts-transform-img.svg?branch=master)
[![Greenkeeper badge](https://badges.greenkeeper.io/longlho/ts-transform-img.svg)](https://greenkeeper.io/)

This is a TypeScript AST Transformer that allows you to write `import * as img from 'foo.png'`. Depending on file size, the img with be base64-inlined in the source or aggregated via `onImgExtracted`.

## Usage
First of all, you need some level of familiarity with the [TypeScript Compiler API](https://github.com/Microsoft/TypeScript/wiki/Using-the-Compiler-API).

`compile.ts` & tests should have examples of how this works. The available options are:

### `threshold?: number`
Threshold of img size that will be inlined, default to 10K

### `interpolateName?: InterpolateNameFn | string`
Function to generate ID for the img asset

### `onImgExtracted(id: string, filePath: string): void`
Function that gets triggered every time we found an asset
