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

  // Update CHANGELOG.md
  const changelogPath = 'CHANGELOG.md'
  if (fs.existsSync(changelogPath)) {
    let changelogContent = fs.readFileSync(changelogPath, 'utf8')

    // Replace [Unreleased] with the current version and today's date
    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    const versionWithDate = `[${packageJson.version}] - ${today}`

    changelogContent = changelogContent.replace(/## \[Unreleased\]/g, `## ${versionWithDate}`)

    // Write updated CHANGELOG.md
    fs.writeFileSync(changelogPath, changelogContent)

    console.log(`✅ Updated CHANGELOG.md: [Unreleased] → ${versionWithDate}`)
  } else {
    console.log('⚠️  CHANGELOG.md not found, skipping changelog update')
  }
}
catch (error) {
  console.error('❌ Error syncing versions:', error.message)
  require('node:process').exit(1)
}
