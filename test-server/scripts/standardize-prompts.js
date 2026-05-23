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
  return templateStr
    .replace('{{TITLE_TYPE}}', titleType)
    .replace('{{GROUP_NAME}}', groupName)
    .replace('{{SCHEMA_REF}}', schemaRef.trim())
    .replace('{{TEST_CONTENT}}', testContent.trim());
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

    // Extract the actual tests. It's bounded between '---' and '---' or '## Post-Test Procedures'
    // Specifically, we look for '## Naming & Cleanup\n...\n---' and extract everything after until '---' and '## Post-Test Procedures'
    const testContentRegex = /## Naming & Cleanup[\s\S]*?---\s*([\s\S]*?)(?:---\s*)?## Post-Test Procedures/;
    const testMatch = content.match(testContentRegex);
    
    if (!testMatch) {
      console.warn(`Could not extract test content for ${file}`);
      continue;
    }
    const testContent = testMatch[1];

    const newContent = getTemplate(titleType, groupName, schemaRef, testContent);
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`Standardized ${file} (${titleType})`);
  }
}

directories.forEach(processDirectory);
console.log("Standardization complete.");
