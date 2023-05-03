# There is no way to imply that "watch" should run first, so we have to check
# if there is any built file in the dist folder.
if [ ! -f dist/index.js ]; then
  tsup >/dev/null
fi

concurrently "chokidar 'source/languages/**' -c 'cp -r source/languages dist'" "tsup --watch" "node dist/index.js" -n lang,build,start -c blue,green,red
