#!/bin/bash
# cmp_r15.sh と同じ比べ方で、さらに「新しいBOM P-2026-xxx」（U15-03 の直しの名前）を「新しいBOM」にそろえて比べる。引数があればその結果の差を出す
cd /home/user/BOM/usertest/newbie
norm() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?//g; s/[0-9]{1,2}\/[0-9]{1,2} [0-9]{1,2}:[0-9]{2}//g; s/"at":[0-9]+//g; s/[0-9]{13}//g; s/\b[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\b//g; s/新しいBOM P-2026-[0-9]+/新しいBOM/g' "$1"; }
if [ -n "$1" ]; then diff <(norm r15/results/$1) <(norm r16/results/$1); exit; fi
for f in r16/results/*.out; do b=$(basename $f); [ -f r15/results/$b ] || continue
  n=$(diff <(norm r15/results/$b) <(norm $f) | grep -c '^[<>]'); [ "$n" != "0" ] && echo "$n $b"; done | sort -rn
