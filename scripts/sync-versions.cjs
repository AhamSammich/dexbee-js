const fs = require('node:fs')

try {
  // Read package.json
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

  // Read jsr.json
  const jsrJson = JSON.parse(fs.readFileSync('jsr.json', 'utf8'))

  // Update jsr.json version to match package.json
  jsrJson.version = packageJson.version

  // Write updated jsr.json
  fs.writeFileSync('jsr.json', `${JSON.stringify(jsrJson, null, 2)}\n`)

  console.log(`✅ Synced jsr.json version to ${packageJson.version}`)
}
catch (error) {
  console.error('❌ Error syncing versions:', error.message)
  require('node:process').exit(1)
}
