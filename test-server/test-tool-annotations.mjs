/**
 * Integration Test: Tool Annotations
 *
 * Verifies that all tools returned by tools/list have annotations
 * with openWorldHint set. db-mcp tools are all local SQLite operations,
 * so all should have openWorldHint: false.
 *
 * Usage:
 *   npm run build
 *   node test-server/test-tool-annotations.mjs
 */

import { spawn } from 'child_process'

const projectDir = 'C:\\Users\\chris\\Desktop\\db-mcp'
const proc = spawn(
    'node',
    [
        'dist/cli.js',
        '--instruction-level',
        'essential',
        '--sqlite',
        './test-server/test.db',
        '--tool-filter',
        '+all',
    ],
    {
        cwd: projectDir,
        stdio: ['pipe', 'pipe', 'pipe'],
    }
)

let buffer = ''
let finished = false

proc.stdout.on('data', (chunk) => {
    buffer += chunk.toString()

    // Try to parse complete JSON-RPC responses
    const lines = buffer.split('\n')
    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
            const msg = JSON.parse(trimmed)
            if (msg.id === 1) {
                // Initialize response — skip
            } else if (msg.id === 2) {
                // tools/list response
                const tools = msg.result?.tools || []
                console.log(`Total tools: ${tools.length}`)

                let withAnnotations = 0
                let openWorldTrue = 0
                let openWorldFalse = 0
                let missing = 0
                const trueNames = []
                const missingNames = []

                for (const tool of tools) {
                    if (tool.annotations) {
                        withAnnotations++
                        if (tool.annotations.openWorldHint === true) {
                            openWorldTrue++
                            trueNames.push(tool.name)
                        } else if (tool.annotations.openWorldHint === false) {
                            openWorldFalse++
                        } else {
                            missing++
                            missingNames.push(tool.name)
                        }
                    } else {
                        missing++
                        missingNames.push(tool.name)
                    }
                }

                console.log(`Tools with annotations: ${withAnnotations}/${tools.length}`)
                console.log(`openWorldHint=false (local): ${openWorldFalse}`)
                console.log(`openWorldHint=true: ${openWorldTrue}`)
                console.log(`Missing openWorldHint: ${missing}`)

                if (trueNames.length > 0) {
                    console.log(`\nopenWorldHint=true tools: ${trueNames.join(', ')}`)
                }
                if (missingNames.length > 0) {
                    console.log(`\nMISSING annotations: ${missingNames.join(', ')}`)
                }

                // Verification
                const allHaveAnnotations = missing === 0
                const allAreFalse = openWorldTrue === 0 && openWorldFalse === tools.length

                console.log(`\n  All tools have annotations: ${allHaveAnnotations ? '✅' : '❌'}`)
                console.log(`  All openWorldHint=false: ${allAreFalse ? '✅' : '⚠️ (some are true)'}`)

                finished = true
                proc.kill()
                process.exit(allHaveAnnotations ? 0 : 1)
            }
        } catch {
            // Not complete JSON yet
        }
    }
})

proc.stderr.on('data', () => {})

// Send initialize
proc.stdin.write(
    JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' },
        },
    }) + '\n'
)

// Wait, then send initialized + tools/list
setTimeout(() => {
    proc.stdin.write(
        JSON.stringify({
            jsonrpc: '2.0',
            method: 'notifications/initialized',
        }) + '\n'
    )

    setTimeout(() => {
        proc.stdin.write(
            JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/list',
                params: {},
            }) + '\n'
        )
    }, 500)
}, 1500)

setTimeout(() => {
    if (!finished) {
        console.log('Timeout — killing process')
        proc.kill()
        process.exit(1)
    }
}, 15000)
