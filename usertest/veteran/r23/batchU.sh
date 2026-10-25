#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
while ! grep -q DONE batchB.status 2>/dev/null; do sleep 10; done
BOM_URL=http://localhost:5197/ nice -n 6 node 254-encodings-wizard.mjs > 254-encodings-wizard.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 254-encodings-wizard.mjs > 254-encodings-wizard-5198.log 2>&1
echo DONE > batchU.status
