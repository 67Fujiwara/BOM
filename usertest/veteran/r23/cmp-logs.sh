#!/bin/bash
# r22 と r23 の同名ログを、時間(ms)・タイムスタンプ・id を落として比べる
cd /home/user/BOM/usertest/veteran/r23
norm() { sed -E 's/"?(ms|elapsed|t|dt|latency[A-Za-z]*|took|time)"?: ?[0-9.]+/\1:N/g; s/[0-9]+(\.[0-9]+)? ?ms/Nms/g; s/[0-9]{2}:[0-9]{2}:[0-9]{2}/T/g; s/20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z?/TS/g; s/P-[A-Za-z0-9]{3,}/P-X/g' "$1"; }
for n in $(grep "^==" sweep.status | awk '{print $2}'); do
  a=../r22/$n.log; b=$n.log
  [ -f $a ] && [ -f $b ] || { echo "MISSING $n (r22:$([ -f $a ] && echo y || echo n) r23:$([ -f $b ] && echo y || echo n))"; continue; }
  d=$(diff <(norm $a) <(norm $b) | grep -c '^[<>]')
  echo "$n diff_lines=$d"
done
