# `@nomicfoundation/solidity-analyzer`

`@nomicfoundation/solidity-analyzer` is an N-API library built in Rust, which exposes a single function, which takes the contents of a Solidity source file and returns its imports and version pragmas.

## Installation

```bash
npm install @nomicfoundation/solidity-analyzer
```

## API

```ts
export interface AnalysisResult {
  versionPragmas: Array<string>;
  imports: Array<string>;
}

export function analyze(input: string): AnalysisResult;
```

## Example

```ts
analyze(`
  pragma solidity ^0.8.0;

  import "./file.sol";
`);

// { versionPragmas: [ '^0.8.0' ], imports: [ './file.sol' ] }
```

## Goals

This library has two different goals:

1. Being fast
2. Being error-tolerant

Both are achieved by not parsing the Solidity source but just tokenizing it instead. This allows us to create a simple state machine that only recognizes imports and pragmas, ignoring everything else, and recovering from malformed tokens or expressions.

## Browser support

This library doesn't work in a browser.