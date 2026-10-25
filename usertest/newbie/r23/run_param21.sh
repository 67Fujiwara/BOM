#!/bin/bash
# 引数（ケースのファイル）が要る r20 までのスクリプトを、r20 と同じ名前の出力で流す
cd /home/user/BOM/usertest/newbie/r23
run() { name=$1; shift; timeout 1500 node "$@" > results/$name.stdout 2>&1; echo "exit $? $name" >> results/_progress_param.txt; }
run r02_paste15 r02_paste15.mjs cases/p15.json
LOGNAME2=r12_paste16 run r12_paste16 r12_paste16.mjs cases/p16.json
LOGNAME2=r12b_paste16b run r12b r12_paste16.mjs cases/p16b.json
LOGNAME2=r21_paste17 run r21_paste17 r21_paste17.mjs cases/p17.json
LOGNAME2=r21b_paste17b run r21b r21_paste17.mjs cases/p17b.json
LOGNAME2=r31_paste18 run r31_paste18 r31_paste18.mjs cases/p18.json
LOGNAME2=r41_paste19 run r41_paste19 r41_paste19.mjs cases/p19.json
LOGNAME2=r41b_paste19b run r41b r41_paste19.mjs cases/p19b.json
LOGNAME2=r55_paste20 run r55_paste20 r55_paste20.mjs cases/p20.json
LOGNAME2=r55_dnpnote run r55_dnpnote r55_paste20.mjs cases/p20e.json
LOGNAME2=r55_dash run r55_dash r55_paste20.mjs cases/p20d.json
echo DONE >> results/_progress_param.txt
