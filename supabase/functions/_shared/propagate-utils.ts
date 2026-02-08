#!/usr/bin/env -S deno run --allow-read --allow-write

const SHARED_UTILS_PATH = new URL("./calculation-utils.ts", import.meta.url).pathname;
const FUNCTIONS_DIR = new URL("../", import.meta.url).pathname;

const GOVERNANCE_START_MARKER = "// === GOVERNANCE: CALCULATION UTILITIES START ===";
const GOVERNANCE_END_MARKER = "// === GOVERNANCE: CALCULATION UTILITIES END ===";

interface PropagationResult {
  functionName: string;
  status: "updated" | "skipped" | "error";
  message: string;
}

async function readGoldenTemplate(): Promise<string> {
  try {
    const content = await Deno.readTextFile(SHARED_UTILS_PATH);
    return content;
  } catch (error) {
    console.error(`Failed to read Golden Template: ${error}`);
    throw error;
  }
}

async function getAllCalculationFunctions(): Promise<string[]> {
  const functions: string[] = [];

  for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
    if (entry.isDirectory && entry.name.startsWith("calculate-")) {
      functions.push(entry.name);
    }
  }

  return functions.sort();
}

function prepareUtilityBlock(templateContent: string): string {
  return `
${GOVERNANCE_START_MARKER}
${templateContent}
${GOVERNANCE_END_MARKER}
`;
}

async function propagateToFunction(
  functionName: string,
  utilityBlock: string
): Promise<PropagationResult> {
  const indexPath = `${FUNCTIONS_DIR}${functionName}/index.ts`;

  try {
    let content = await Deno.readTextFile(indexPath);

    const startIndex = content.indexOf(GOVERNANCE_START_MARKER);
    const endIndex = content.indexOf(GOVERNANCE_END_MARKER);

    if (startIndex !== -1 && endIndex !== -1) {
      const beforeBlock = content.substring(0, startIndex);
      const afterBlock = content.substring(endIndex + GOVERNANCE_END_MARKER.length);

      content = beforeBlock + utilityBlock + afterBlock;

      await Deno.writeTextFile(indexPath, content);

      return {
        functionName,
        status: "updated",
        message: "Governance block replaced successfully"
      };
    } else {
      const importEndIndex = content.indexOf('\n\n');

      if (importEndIndex !== -1) {
        const beforeImports = content.substring(0, importEndIndex);
        const afterImports = content.substring(importEndIndex);

        content = beforeImports + '\n' + utilityBlock + afterImports;

        await Deno.writeTextFile(indexPath, content);

        return {
          functionName,
          status: "updated",
          message: "Governance block injected after imports"
        };
      } else {
        return {
          functionName,
          status: "skipped",
          message: "Could not find suitable injection point"
        };
      }
    }
  } catch (error) {
    return {
      functionName,
      status: "error",
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function main() {
  const templateContent = await readGoldenTemplate();
  const functions = await getAllCalculationFunctions();
  const utilityBlock = prepareUtilityBlock(templateContent);
  const results: PropagationResult[] = [];

  for (const functionName of functions) {
    const result = await propagateToFunction(functionName, utilityBlock);
    results.push(result);

    const icon = result.status === "updated" ? "✅" :
                 result.status === "skipped" ? "⚠️" : "❌";
  }
  const updated = results.filter(r => r.status === "updated").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errors = results.filter(r => r.status === "error").length;
  if (errors > 0) {
    results
      .filter(r => r.status === "error")
      .forEach(r => console.warn(`   - ${r.functionName}: ${r.message}`));
  }

  if (skipped > 0) {
    results
      .filter(r => r.status === "skipped")
      .forEach(r => console.warn(`   - ${r.functionName}: ${r.message}`));
  }
  if (errors > 0) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
