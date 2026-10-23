#!/bin/bash
cd /home/user/BOM/usertest/newbie
norm() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?//g; s/[0-9]{1,2}\/[0-9]{1,2} [0-9]{1,2}:[0-9]{2}//g; s/"at":[0-9]+//g; s/[0-9]{13}//g; s/\b[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\b//g' "$1"; }
diff <(norm r14/results/$1) <(norm r15/results/$1)
