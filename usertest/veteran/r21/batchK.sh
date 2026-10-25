#!/bin/bash
cd /home/user/BOM/usertest/veteran/r21
while ! grep -q DONE batchJ.status 2>/dev/null; do sleep 15; done
(bash sweepL0.sh; bash sweepL1.sh) > /dev/null 2>&1 &
bash sweepL2.sh > /dev/null 2>&1
wait
echo DONE >> batchK.status
