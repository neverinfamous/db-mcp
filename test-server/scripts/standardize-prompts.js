import fs from 'fs';
import path from 'path';

const directories = [
  'test-codemode',
  'test-advanced',
  'test-tool-groups'
];

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = path.join(__dirname, '..');
const templatePath = path.join(__dirname, 'prompt-template.md');

if (!fs.existsSync(templatePath)) {
  console.error("Missing template file: " + templatePath);
  process.exit(1);
}

const templateStr = fs.readFileSync(templatePath, 'utf-8');

const getTemplate = (titleType, groupName, schemaRef, testContent) => {
  // Use replacer functions (not string literals) to prevent $-substitution.
  // String.prototype.replace() interprets $&, $', $`, $n in string replacements.
  // Test content may contain $ (e.g. regex patterns like `@gmail\\.com$`).
  return templateStr
    .replace('{{TITLE_TYPE}}', () => titleType)
    .replace('{{GROUP_NAME}}', () => groupName)
    .replace('{{SCHEMA_REF}}', () => schemaRef.trim())
    .replace('{{TEST_CONTENT}}', () => testContent.trim());
};

function processDirectory(dirName) {
  const dirPath = path.join(basePath, dirName);
  if (!fs.existsSync(dirPath)) return;

  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'prompt-template.md');

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    let content = fs.readFileSync(filePath, 'utf-8');

    // Extract group name
    const titleMatch = content.match(/# db-mcp .*: \[(.*?)\]/);
    if (!titleMatch) {
      console.warn(`Could not find group name in ${file}`);
      continue;
    }
    const groupName = titleMatch[1];
    
    // Determine title type based on directory logic to prevent overwriting
    let titleType = 'Tool Group Testing';
    if (dirName === 'test-advanced') {
      titleType = 'Advanced Stress Testing'; // Note: previously the script generated "Advanced Stress Test", changed to "Testing" for consistency
    } else if (dirName === 'test-codemode') {
      titleType = 'Code Mode Testing';
    }

    // Extract Schema Reference
    // We look for '### Test Schema Reference' until '## Reporting Format'
    const schemaMatch = content.match(/### Test Schema Reference([\s\S]*?)## Reporting Format/);
    let schemaRef = "> *No specific table schema required for this test group.*";
    if (schemaMatch) {
      const extractedSchema = schemaMatch[1].trim();
      // Only keep the extracted schema if it contains a table definition (not the error scenario list) or CSV hint
      if (extractedSchema.includes('| Table') || extractedSchema.includes('CSV testing')) {
        schemaRef = extractedSchema;
      }
      
      // Some weird cases where error scenario table was pasted here
      if (extractedSchema.includes('Error Scenario') && !extractedSchema.includes('CSV testing')) {
         schemaRef = "> *No specific table schema required for this test group.*";
      }
    }

    // Extract the actual tests using line-based boundary detection.
    // The test content lives between two `---` separators:
    //   1. The `---` immediately after "## Naming & Cleanup" (start boundary)
    //   2. The `---` immediately before "## Post-Test Procedures" (end boundary)
    // We scan lines instead of using a single regex to avoid fragility with
    // special characters in test content (backslashes, $, etc.).
    const lines = content.split('\n');
    const namingIdx = lines.findIndex(l => l.startsWith('## Naming & Cleanup'));
    const postTestIdx = lines.findIndex(l => l.startsWith('## Post-Test Procedures'));

    if (namingIdx === -1 || postTestIdx === -1) {
      console.warn(`Could not find section boundaries in ${file}`);
      continue;
    }

    // Find the first `---` after "## Naming & Cleanup" (start boundary)
    let startSepIdx = -1;
    for (let i = namingIdx + 1; i < postTestIdx; i++) {
      if (lines[i].trim() === '---') { startSepIdx = i; break; }
    }

    // Find the last `---` before "## Post-Test Procedures" (end boundary)
    let endSepIdx = -1;
    for (let i = postTestIdx - 1; i > namingIdx; i--) {
      if (lines[i].trim() === '---') { endSepIdx = i; break; }
    }

    if (startSepIdx === -1) {
      console.warn(`Could not find start separator after Naming & Cleanup in ${file}`);
      continue;
    }

    // If start and end separators are the same line, there's no test content
    if (startSepIdx === endSepIdx) {
      console.warn(`No test content found between separators in ${file}`);
      continue;
    }

    // Extract content between the two separators (exclusive of the --- lines)
    // If endSepIdx is -1 (no end separator), take everything up to Post-Test
    const contentEndIdx = endSepIdx !== -1 ? endSepIdx : postTestIdx;
    const testContent = lines.slice(startSepIdx + 1, contentEndIdx).join('\n');

    const newContent = getTemplate(titleType, groupName, schemaRef, testContent);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Standardized ${file} (${titleType})`);
  }
}

directories.forEach(processDirectory);
console.log("Standardization complete.");
