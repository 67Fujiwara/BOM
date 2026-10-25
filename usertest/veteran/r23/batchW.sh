#!/bin/bash
cd /home/user/BOM/usertest/veteran/r23
BOM_URL=http://localhost:5197/ nice -n 6 node 240-header-wizard.mjs > 240-header-wizard.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 240-header-wizard.mjs > 240-header-wizard-5198.log 2>&1
echo DONE > batchW.status
