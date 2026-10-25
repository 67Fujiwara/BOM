#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
S=batchU.status; : > $S
while [ "$(cat sweepL.done 2>/dev/null | wc -l)" -lt 2 ]; do sleep 20; done
r() { local name=$1; shift; echo "== $name $(date +%T) load=$(cut -d' ' -f1-3 /proc/loadavg)" >> $S; timeout 1200 nice -n 6 env "$@" > "$name.log" 2>&1; echo "   exit $? $(date +%T)" >> $S; }
python3 254-encodings-make.py > /dev/null 2>&1
r 254-enc-5197 BOM_URL=http://localhost:5197/ TAG=-5197 node 254-encodings-wizard.mjs
r 254-enc-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 254-encodings-wizard.mjs
r 250-removed-ui PORT=5176 RUN=-run1 node 250-removed-supplier-ui.mjs
r 251-json-dupes PORT=5176 RUN=-run1 node 251-json-dupes.mjs
r 253-keydup PORT=5176 RUN=-run1 node 253-keydup.mjs
r 256-export-removed PORT=5176 RUN=-run1 node 256-export-removed.mjs
r 203-sequence PORT=5176 node 203-sequence-mode.mjs
r 174-flagged-latency PORT=5176 RUN=-run1 node 174-flagged-latency.mjs
bash batchH22.sh
r 240-wizard-5197 BOM_URL=http://localhost:5197/ TAG=-5197 node 240-header-wizard.mjs
r 240-wizard-5198 BOM_URL=http://localhost:5198/ TAG=-5198 node 240-header-wizard.mjs
bash sweepL2.sh
echo ALLDONE >> $S
