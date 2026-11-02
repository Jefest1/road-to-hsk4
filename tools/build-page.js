// Wraps page.html into index.html for the desktop app. The web version publishes page.html as it is.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const csp = "default-src 'self' file: 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' file: data:";
const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"></head><body>`;
fs.writeFileSync(path.join(root, "index.html"), head + fs.readFileSync(path.join(root, "page.html"), "utf8") + "</body></html>");
console.log("index.html written");
