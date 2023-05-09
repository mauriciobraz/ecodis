tsup >/dev/null
concurrently "chokidar 'source/languages/**' -c 'cp -r source/languages dist'" "tsup --watch" "pnpm run start" -n lang,build,start -c "bgBlue.bold,bgMagenta.bold,bgCyan.bold"
