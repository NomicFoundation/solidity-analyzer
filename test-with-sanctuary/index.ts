import { parse, visit } from "@solidity-parser/parser";
import { isEqual } from "lodash";
import { analyze, AnalysisResult } from "..";
import fs from "fs";
import path from "path";
import {
  ImportDirective,
  PragmaDirective,
} from "@solidity-parser/parser/dist/src/ast-types";
import chalk from "chalk";
chalk.level = 3;

const COLORS = [
  "#1BE7FF",
  "#6EEB83",
  "#A9F54F",
  "#E4FF1A",
  "#FFB800",
  "#FF880A",
  "#FF700F",
  "#FF5714",
] as const;

function analyzeWithJsParser(content: string): AnalysisResult {
  const ast = parse(content, { tolerant: true, range: true });

  const imports: string[] = [];
  const versionPragmas: string[] = [];

  visit(ast, {
    ImportDirective: (node: ImportDirective) => imports.push(node.path),
    PragmaDirective: (node: PragmaDirective) => {
      if (node.name === "solidity") {
        const range = content.substring(node.range![0], node.range![1]);
        const match = range.match(/pragma\s+solidity\s+(.*)/);
        if (match) {
          versionPragmas.push(
            match[1].trimEnd().replace("\r", "").replace("\n", "")
          );
        } else {
          versionPragmas.push(node.value);
        }
      }
    },
  });

  return { versionPragmas, imports };
}

function analyzeWithRusParser(content: string): AnalysisResult {
  return analyze(content);
}

function test(path: string) {
  const content = fs.readFileSync(path, "utf-8");

  let withJs;
  try {
    withJs = analyzeWithJsParser(content);
  } catch (e) {
    console.log("Skipping", path);
    console.error("Failed to parse with the Js parser", path);
    return;
  }

  const withRust = analyzeWithRusParser(content);

  if (!isEqual(withJs, withRust)) {
    console.log(path);
    console.error(`Differences found in ${path}

With Js: ${JSON.stringify(withJs)}

With Rust: ${JSON.stringify(withRust)}
`);
  }
}

function* getAllSolFiles(dirPath: string): Generator<string> {
  const dirFiles = fs.readdirSync(dirPath);

  for (const file of dirFiles) {
    let filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      yield* getAllSolFiles(filePath);
    } else {
      if (filePath.endsWith(".sol")) {
        yield filePath;
      }
    }
  }
}

if (process.argv.length !== 5) {
  console.error("Invalid arguments");
  console.error(
    "Use: yarn ts-node index.ts <path-to-sanctuary> <number-of-workers> <worker-id>"
  );
  process.exit(1);
}

let i = 0;
const dir = fs.realpathSync(process.argv[2]);
const totalWorkers = parseInt(process.argv[3], 10);
const workerId = parseInt(process.argv[4], 10);

let latestTime = new Date();

for (const file of getAllSolFiles(dir)) {
  i++;

  if (i % totalWorkers != workerId) {
    continue;
  }

  try {
    test(file);
  } catch (e) {
    if (file.toLowerCase().includes("vyper")) {
      continue;
    }

    console.error(`Failed to ${file}`);
    throw e;
  }

  if (i % 100 === 0) {
    let now = new Date();

    let diff = now.getTime() - latestTime.getTime();
    const filesPerSec = (1000 / diff) * 100;
    latestTime = now;

    console.error(
      chalk.hex(COLORS[workerId])(
        `[Worker ${workerId}] (${filesPerSec
          .toFixed(2)
          .padStart(5, "0")} files/sec)`
      )
    );
  }
}

console.error(chalk.hex(COLORS[workerId])(`[Worker ${workerId}] Finished`));
