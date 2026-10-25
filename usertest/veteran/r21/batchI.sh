#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
# batchH が終わるまで待つ
while ! grep -q DONE batchH.status 2>/dev/null; do sleep 10; done
nice -n 6 node 170-ordinary-big-make.mjs > 170-ordinary-big-make.log 2>&1
BOM_URL=http://localhost:5197/ TAG= nice -n 6 node 170-ordinary-big.mjs > 170-ordinary-big.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 170-ordinary-big.mjs > 170-ordinary-big-5198.log 2>&1
# 144 の 300 行 d1〜d6
nice -n 6 node 144-big19-make.mjs > 144-big19-make.log 2>&1
BOM_URL=http://localhost:5197/ TAG= nice -n 6 node 144-big19.mjs > 144-big19.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 144-big19.mjs > 144-big19-5198.log 2>&1
# W18 の画面
ONLY=W18 BOM_URL=http://localhost:5197/ TAG=-w18 nice -n 6 node 201-header-wizard.mjs > 201-header-wizard-w18.log 2>&1
ONLY=W18 BOM_URL=http://localhost:5198/ TAG=-w18-5198 nice -n 6 node 201-header-wizard.mjs > 201-header-wizard-w18-5198.log 2>&1
echo DONE >> batchI.status
