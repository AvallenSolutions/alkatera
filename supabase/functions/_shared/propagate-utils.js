#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SHARED_UTILS_PATH = path.join(__dirname, 'calculation-utils.ts');
const FUNCTIONS_DIR = path.join(__dirname, '..');

const GOVERNANCE_START_MARKER = "// === GOVERNANCE: CALCULATION UTILITIES START ===";
const GOVERNANCE_END_MARKER = "// === GOVERNANCE: CALCULATION UTILITIES END ===";

function readGoldenTemplate() {
  try {
    return fs.readFileSync(SHARED_UTILS_PATH, 'utf8');
  } catch (error) {
    console.error(`Failed to read Golden Template: ${error.message}`);
    throw error;
  }
}

function getAllCalculationFunctions() {
  const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory() && entry.name.startsWith('calculate-'))
    .map(entry => entry.name)
    .sort();
}

function prepareUtilityBlock(templateContent) {
  return `
${GOVERNANCE_START_MARKER}
${templateContent}
${GOVERNANCE_END_MARKER}
`;
}

function propagateToFunction(functionName, utilityBlock) {
  const indexPath = path.join(FUNCTIONS_DIR, functionName, 'index.ts');

  try {
    let content = fs.readFileSync(indexPath, 'utf8');

    const startIndex = content.indexOf(GOVERNANCE_START_MARKER);
    const endIndex = content.indexOf(GOVERNANCE_END_MARKER);

    if (startIndex !== -1 && endIndex !== -1) {
      const beforeBlock = content.substring(0, startIndex);
      const afterBlock = content.substring(endIndex + GOVERNANCE_END_MARKER.length);

      content = beforeBlock + utilityBlock + afterBlock;

      fs.writeFileSync(indexPath, content, 'utf8');

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

        fs.writeFileSync(indexPath, content, 'utf8');

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
      message: `Error: ${error.message}`
    };
  }
}

function main() {
  const templateContent = readGoldenTemplate();
  const functions = getAllCalculationFunctions();
  const utilityBlock = prepareUtilityBlock(templateContent);
  const results = [];

  for (const functionName of functions) {
    const result = propagateToFunction(functionName, utilityBlock);
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
    process.exit(1);
  }
}

main();
