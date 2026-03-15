/**
 * Integration Test: Help Resources + Slim Instructions
 *
 * Starts the server with various --tool-filter configs and verifies:
 * 1. Instructions are slim (~680 chars, within client limits)
 * 2. sqlite://help resources are registered based on tool filter
 * 3. Group-specific help resources are only registered for enabled groups
 *
 * Usage:
 *   npm run build
 *   node test-server/test-help-resources.mjs
 */

import { spawn } from 'child_process'

const PROJECT_DIR = 'C:\\Users\\chris\\Desktop\\db-mcp'

/**
 * Start server, send initialize + resources/list, return results
 */
function testServer(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', ['dist/cli.js', ...args], {
            cwd: PROJECT_DIR,
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        let buffer = ''
        let instructions = ''
        let resourceUris = []
        let gotInitialize = false

        proc.stdout.on('data', (chunk) => {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            buffer = lines.pop() // Keep incomplete line

            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                try {
                    const msg = JSON.parse(trimmed)

                    // Response to initialize (id=1)
                    if (msg.id === 1 && msg.result) {
                        instructions =
                            msg.result?.serverInfo?.instructions ||
                            msg.result?.instructions ||
                            msg.result?.capabilities?.instructions ||
                            ''
                        gotInitialize = true

                        // Send resources/list
                        proc.stdin.write(
                            JSON.stringify({
                                jsonrpc: '2.0',
                                id: 2,
                                method: 'resources/list',
                                params: {},
                            }) + '\n'
                        )
                    }

                    // Response to resources/list (id=2)
                    if (msg.id === 2 && msg.result) {
                        const resources = msg.result.resources || []
                        resourceUris = resources.map((r) => r.uri)
                        proc.kill()
                        resolve({
                            instructions,
                            instructionChars: instructions.length,
                            resourceUris,
                        })
                    }
                } catch {
                    // Not complete JSON yet
                }
            }
        })

        proc.stderr.on('data', () => {})

        // Send initialize request
        proc.stdin.write(
            JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'initialize',
                params: {
                    protocolVersion: '2025-03-26',
                    capabilities: {},
                    clientInfo: { name: 'help-resource-test', version: '1.0' },
                },
            }) + '\n'
        )

        setTimeout(() => {
            proc.kill()
            reject(new Error(`Timeout for args: ${args.join(' ')}`))
        }, 10000)
    })
}

async function main() {
    let allPassed = true

    // ── Test 1: Slim Instructions ──
    console.log('=== Test 1: Slim Instructions ===\n')

    const baseResult = await testServer([])
    console.log(`  Instruction chars: ${baseResult.instructionChars}`)
    console.log(`  Token estimate: ~${Math.round(baseResult.instructionChars / 4)}`)

    const isSlim = baseResult.instructionChars < 1000
    console.log(`  Under 1000 chars: ${isSlim ? '✅' : '❌'}`)
    if (!isSlim) allPassed = false

    const hasHelpPointer = baseResult.instructions.includes('sqlite://help')
    console.log(`  Contains sqlite://help pointer: ${hasHelpPointer ? '✅' : '❌'}`)
    if (!hasHelpPointer) allPassed = false

    const noOldContent = !baseResult.instructions.includes('Critical Gotchas')
    console.log(`  No old gotchas in instructions: ${noOldContent ? '✅' : '❌'}`)
    if (!noOldContent) allPassed = false

    // ── Test 2: Core-only Filter ──
    console.log('\n=== Test 2: Core-only Filter (--tool-filter core) ===\n')

    const coreResult = await testServer(['--tool-filter', 'core'])
    const coreHelpUris = coreResult.resourceUris.filter((u) => u.startsWith('sqlite://help'))
    console.log(`  Help resources: ${coreHelpUris.join(', ') || '(none)'}`)

    const coreHasBaseHelp = coreHelpUris.includes('sqlite://help')
    console.log(`  Has sqlite://help: ${coreHasBaseHelp ? '✅' : '❌'}`)
    if (!coreHasBaseHelp) allPassed = false

    const coreNoGroupHelp = coreHelpUris.length === 1
    console.log(`  No group-specific help: ${coreNoGroupHelp ? '✅' : '❌'} (count: ${coreHelpUris.length})`)
    if (!coreNoGroupHelp) allPassed = false

    // ── Test 3: Stats Filter ──
    console.log('\n=== Test 3: Stats Filter (--tool-filter stats) ===\n')

    const statsResult = await testServer(['--tool-filter', 'stats'])
    const statsHelpUris = statsResult.resourceUris.filter((u) => u.startsWith('sqlite://help'))
    console.log(`  Help resources: ${statsHelpUris.join(', ')}`)

    const statsHasBaseHelp = statsHelpUris.includes('sqlite://help')
    const statsHasStatsHelp = statsHelpUris.includes('sqlite://help/stats')
    console.log(`  Has sqlite://help: ${statsHasBaseHelp ? '✅' : '❌'}`)
    console.log(`  Has sqlite://help/stats: ${statsHasStatsHelp ? '✅' : '❌'}`)
    if (!statsHasBaseHelp || !statsHasStatsHelp) allPassed = false

    const statsNoJsonHelp = !statsHelpUris.includes('sqlite://help/json')
    console.log(`  No sqlite://help/json: ${statsNoJsonHelp ? '✅' : '❌'}`)
    if (!statsNoJsonHelp) allPassed = false

    // ── Test 4: Multi-group Filter ──
    console.log('\n=== Test 4: Multi-group Filter (--tool-filter core,json,text,stats) ===\n')

    const multiResult = await testServer(['--tool-filter', 'core,json,text,stats'])
    const multiHelpUris = multiResult.resourceUris.filter((u) => u.startsWith('sqlite://help'))
    console.log(`  Help resources: ${multiHelpUris.join(', ')}`)

    const expectedMulti = ['sqlite://help', 'sqlite://help/json', 'sqlite://help/text', 'sqlite://help/stats']
    for (const uri of expectedMulti) {
        const found = multiHelpUris.includes(uri)
        console.log(`  Has ${uri}: ${found ? '✅' : '❌'}`)
        if (!found) allPassed = false
    }

    const multiNoVector = !multiHelpUris.includes('sqlite://help/vector')
    const multiNoGeo = !multiHelpUris.includes('sqlite://help/geo')
    console.log(`  No sqlite://help/vector: ${multiNoVector ? '✅' : '❌'}`)
    console.log(`  No sqlite://help/geo: ${multiNoGeo ? '✅' : '❌'}`)
    if (!multiNoVector || !multiNoGeo) allPassed = false

    // ── Test 5: Full Filter ──
    console.log('\n=== Test 5: Full Filter (--tool-filter full) ===\n')

    const fullResult = await testServer(['--tool-filter', 'full'])
    const fullHelpUris = fullResult.resourceUris.filter((u) => u.startsWith('sqlite://help'))
    console.log(`  Help resources (${fullHelpUris.length}): ${fullHelpUris.join(', ')}`)

    const expectedFull = [
        'sqlite://help',
        'sqlite://help/json',
        'sqlite://help/text',
        'sqlite://help/stats',
        'sqlite://help/vector',
        'sqlite://help/geo',
        'sqlite://help/admin',
    ]
    const fullHasAll = expectedFull.every((u) => fullHelpUris.includes(u))
    console.log(`  Has all 7 help resources: ${fullHasAll ? '✅' : '❌'}`)
    if (!fullHasAll) allPassed = false

    // ── Summary ──
    console.log(`\n=== Overall: ${allPassed ? '✅ ALL PASSED' : '❌ FAILURES'} ===`)
    process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
    console.error('Fatal:', err.message)
    process.exit(1)
})
