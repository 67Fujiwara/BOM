#!/bin/bash
# r22 の結果（*.out）と r23 の結果を、日時・時刻・BOM の名前の番号を消してから比べる。差のある行数を出す。引数があればその結果の差を出す
cd /home/user/BOM/usertest/newbie
norm() { sed -E 's/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?//g; s/[0-9]{1,2}\/[0-9]{1,2} [0-9]{1,2}:[0-9]{2}//g; s/"at":[0-9]+//g; s/[0-9]{13}//g; s/\b[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?\b//g; s/新しいBOM P-2026-[0-9]+/新しいBOM/g; s/P-2026-0[0-9]{2}/P-2026-0xx/g' "$1"; }
if [ -n "$1" ]; then diff <(norm r22/results/$1) <(norm r23/results/$1); exit; fi
for f in r23/results/*.out; do b=$(basename $f); [ -f r22/results/$b ] || continue
  n=$(diff <(norm r22/results/$b) <(norm $f) | grep -c '^[<>]'); [ "$n" != "0" ] && echo "$n $b"; done | sort -rn
