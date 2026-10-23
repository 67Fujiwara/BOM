#!/bin/sh
cd /home/user/BOM
for f in 01a-palette-focus 01b-data-rules 01c-storage-json 01d-grid-undo 03-malformed 04-burst 04b-burst-rows 05-window 05b-window-ab 05c-sort-edit 06-backup 07-twotab 07b-twotab-settings 08-undo 08b-undo-ops 09-reload-state 09b-reload-wizard 10-keymap 11-io 12-misc 13-reload-edit 14-offset-quota; do
  echo "=== $f $(date +%T)"
  timeout 900 node usertest/veteran/r5/rerun3/$f.mjs > usertest/veteran/r5/rerun3/$f.out 2>&1
  echo "exit $? $(date +%T)"
done
