#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
while ! grep -q DONE batchI.status 2>/dev/null; do sleep 10; done
BOM_URL=http://localhost:5197/ nice -n 6 node 201-header-wizard.mjs > 201-header-wizard.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 201-header-wizard.mjs > 201-header-wizard-5198.log 2>&1
echo DONE >> batchJ.status
