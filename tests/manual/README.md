# Manual Browser Testing

## How to Run Manual Tests

The manual test HTML file requires a local web server due to browser CORS policies. Here are three ways to run it:

### Option 1: Using Python (Simplest)

```bash
# From the project root
pnpm build

# Start a simple HTTP server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080/tests/manual/blob-test.html
```

### Option 2: Using Node.js http-server

```bash
# Install http-server globally (one time)
npm install -g http-server

# From project root
pnpm build

# Start server
http-server -p 8080

# Open in browser
open http://localhost:8080/tests/manual/blob-test.html
```

### Option 3: Using VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click on `tests/manual/blob-test.html`
3. Select "Open with Live Server"

### Option 4: Add npm script (Recommended)

I'll add a convenient script to package.json for you!
