#!/usr/bin/env node
// PreToolUse hook: refuse Edit/Write/MultiEdit on a pb_migrations/*.js file that has already
// shipped on origin/main. Migrations that already applied elsewhere must not be rewritten —
// see CLAUDE.md -> "Migration conventions" / .claude/rules/migrations.md.
const path = require('path')
const { spawnSync } = require('child_process')

let input = ''
process.stdin.on('data', (d) => (input += d))
process.stdin.on('end', () => {
  let payload
  try {
    payload = JSON.parse(input)
  } catch {
    process.exit(0)
  }

  const filePath = payload.tool_input && payload.tool_input.file_path
  if (!filePath || !/[\\/]pb_migrations[\\/][^\\/]+\.js$/.test(filePath)) {
    process.exit(0)
  }

  const cwd = payload.cwd || process.cwd()
  const rel = path.relative(cwd, filePath).split(path.sep).join('/')

  const res = spawnSync('git', ['show', `origin/main:${rel}`], { cwd, stdio: 'ignore' })
  if (res.status !== 0) {
    // Not present on origin/main -> new/local-only migration, safe to edit.
    process.exit(0)
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${rel} already shipped on main — write a new migration instead of editing this one (CLAUDE.md -> "Migration conventions").`,
      },
    })
  )
  process.exit(0)
})
