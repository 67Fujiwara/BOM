#!/bin/sh
cd /home/user/BOM
while kill -0 6363 2>/dev/null; do sleep 5; done
for f in 22-malformed2 23-backup 24-misc 25-palette 26-twotab 27-reload 27b-reload-hist 28-files 20-burst2; do
  echo "=== $f $(date +%T)"
  timeout 1200 node usertest/veteran/r5/rerun4/$f.mjs > usertest/veteran/r5/rerun4/$f.log 2>&1
  echo "exit $? $(date +%T)"
done
