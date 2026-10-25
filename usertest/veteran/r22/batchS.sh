#!/bin/bash
cd /home/user/BOM/usertest/veteran/r22
while ! grep -q DONE batchW2.status 2>/dev/null; do sleep 10; done
(bash sweepL0.sh; bash sweepL1.sh) > /dev/null 2>&1 &
bash sweepL2.sh > /dev/null 2>&1
wait
echo DONE > batchS.status
