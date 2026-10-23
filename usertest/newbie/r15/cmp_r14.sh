#!/bin/bash
# r14 と r15 の結果（*.out）を、日時・時刻を消してから比べる。差のある行数を出す
cd /home/user/BOM/usertest/newbie
norm() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?//g; s/[0-9]{1,2}\/[0-9]{1,2} [0-9]{1,2}:[0-9]{2}//g; s/"at":[0-9]+//g; s/[0-9]{13}//g; s/\b[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\b//g' "$1"; }
for f in r15/results/*.out; do b=$(basename $f); [ -f r14/results/$b ] || continue
  n=$(diff <(norm r14/results/$b) <(norm $f) | grep -c '^[<>]'); [ "$n" != "0" ] && echo "$n $b"; done | sort -rn
