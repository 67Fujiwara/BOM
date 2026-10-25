#!/bin/bash
# r17 と r18 の結果（*.out）を、日時・時刻・BOM の名前の番号を消してから比べる。差のある行数を出す。引数があればその結果の差を出す
cd /home/user/BOM/usertest/newbie
norm() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?//g; s/[0-9]{1,2}\/[0-9]{1,2} [0-9]{1,2}:[0-9]{2}//g; s/"at":[0-9]+//g; s/[0-9]{13}//g; s/\b[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\b//g; s/新しいBOM P-2026-[0-9]+/新しいBOM/g' "$1"; }
if [ -n "$1" ]; then diff <(norm r17/results/$1) <(norm r18/results/$1); exit; fi
for f in r18/results/*.out; do b=$(basename $f); [ -f r17/results/$b ] || continue
  n=$(diff <(norm r17/results/$b) <(norm $f) | grep -c '^[<>]'); [ "$n" != "0" ] && echo "$n $b"; done | sort -rn
