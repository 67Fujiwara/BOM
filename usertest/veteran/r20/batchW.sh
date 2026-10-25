#!/bin/bash
cd /home/user/BOM/usertest/veteran/r20
BOM_URL=http://localhost:5176/ nice -n 5 node 156-header-wizard.mjs > 156-header-wizard.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 5 node 156-header-wizard.mjs > 156-header-wizard-5198.log 2>&1
BOM_URL=http://localhost:5176/ TAG=-qc ONLY='QC1[4-7]' nice -n 5 node 150-header-wizard.mjs > 150-header-wizard-qc.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-qc-5198 ONLY='QC1[4-7]' nice -n 5 node 150-header-wizard.mjs > 150-header-wizard-qc-5198.log 2>&1
echo done > batchW.status
