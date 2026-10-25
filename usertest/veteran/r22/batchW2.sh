#!/bin/bash
cd /home/user/BOM/usertest/veteran/r22
ONLY='^(M0|M10|Z0|T0|X0)' BOM_URL=http://localhost:5197/ TAG=-w2 nice -n 6 node 240-header-wizard.mjs > 240-header-wizard-w2.log 2>&1
ONLY='^(M0|M10|Z0|T0|X0)' BOM_URL=http://localhost:5198/ TAG=-w2-5198 nice -n 6 node 240-header-wizard.mjs > 240-header-wizard-w2-5198.log 2>&1
echo DONE > batchW2.status
