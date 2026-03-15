/**
 * Integration Test: Instruction Levels + Filtered Instructions
 *
 * Starts the server with each --instruction-level value (essential, standard, full)
 * and verifies that instruction text length increases across levels.
 * Also tests that --tool-filter reduces instructions at the 'full' level.
 *
 * Usage:
 *   npm run build
 *   node test-database/test-instruction-levels.mjs
 */

import { spawn } from 'child_process'

const PROJECT_DIR = 'C:\\Users\\chris\\Desktop\\db-mcp'
const LEVELS = ['essential', 'standard', 'full']

/**
 * Start server with given args, send initialize, return instruction text
 */
function testServer(args) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', ['dist/cli.js', ...args], {
            cwd: PROJECT_DIR,
            stdio: ['pipe', 'pipe', 'pipe'],
        })

        let buffer = ''
        proc.stdout.on('data', (chunk) => {
            buffer += chunk.toString()
            const lines = buffer.split('\n')
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed) continue
                try {
                    const msg = JSON.parse(trimmed)
                    if (msg.id === 1 && msg.result) {
                        const instructions =
                            msg.result?.serverInfo?.instructions || msg.result?.instructions || ''

                        // Also check for the instructions field in capabilities
                        const capInstructions = msg.result?.capabilities?.instructions || ''
                        const text = instructions || capInstructions

                        proc.kill()
                        resolve({
                            charCount: text.length,
                            tokenEstimate: Math.round(text.length / 4),
                            text,
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
                    clientInfo: { name: 'instruction-test', version: '1.0' },
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

    // ── Test 1: Level Ordering ──
    console.log('=== Test 1: Instruction Level Ordering ===\n')

    const results = []
    for (const level of LEVELS) {
        const result = await testServer(['--instruction-level', level])
        results.push({ level, ...result })
        console.log(`  ${level}: ${result.charCount} chars (~${result.tokenEstimate} tokens)`)
    }

    const [essential, standard, full] = results
    const orderCorrect =
        essential.charCount < standard.charCount && standard.charCount < full.charCount

    console.log(`\n  Order correct (essential < standard < full): ${orderCorrect ? '✅' : '❌'}`)
    console.log(
        `    ${essential.tokenEstimate} < ${standard.tokenEstimate} < ${full.tokenEstimate}`
    )
    if (!orderCorrect) allPassed = false

    // ── Test 2: Filtered Instructions ──
    console.log('\n=== Test 2: Filtered Instructions (--tool-filter) ===\n')

    // Full level with no filter (all groups)
    const fullAll = await testServer(['--instruction-level', 'full'])
    console.log(`  full (all groups): ${fullAll.charCount} chars (~${fullAll.tokenEstimate} tokens)`)

    // Full level with core-only filter
    const fullCore = await testServer(['--instruction-level', 'full', '--tool-filter', 'core'])
    console.log(`  full (core only):  ${fullCore.charCount} chars (~${fullCore.tokenEstimate} tokens)`)

    // Filtered should be shorter
    const filterReduced = fullCore.charCount < fullAll.charCount
    const savings = fullAll.charCount - fullCore.charCount
    const pct = ((savings / fullAll.charCount) * 100).toFixed(1)
    console.log(`\n  Filtered < unfiltered: ${filterReduced ? '✅' : '❌'} (saved ${savings} chars, ${pct}%)`)
    if (!filterReduced) allPassed = false

    // Filtered should NOT contain JSON/Vector/Stats/Geo/Admin sections
    const shouldExclude = ['JSON Operations', 'Vector/Semantic Search', 'Statistical Analysis', 'Geospatial Operations', 'Database Administration']
    const excludeResults = []
    for (const section of shouldExclude) {
        const found = fullCore.text.includes(section)
        excludeResults.push({ section, excluded: !found })
        console.log(`  Excludes "${section}": ${found ? '❌ FOUND' : '✅'}`)
    }
    if (excludeResults.some(r => !r.excluded)) allPassed = false

    // Filtered SHOULD contain _always sections
    const shouldInclude = ['Critical Gotchas', 'Code Mode API Mapping']
    for (const section of shouldInclude) {
        const found = fullCore.text.includes(section)
        console.log(`  Includes "${section}": ${found ? '✅' : '❌ MISSING'}`)
        if (!found) allPassed = false
    }

    // ── Summary ──
    console.log(`\n=== Overall: ${allPassed ? '✅ ALL PASSED' : '❌ FAILURES'} ===`)
    process.exit(allPassed ? 0 : 1)
}

main().catch((err) => {
    console.error('Fatal:', err.message)
    process.exit(1)
})
