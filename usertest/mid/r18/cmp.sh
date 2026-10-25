#!/bin/bash
# r17 と r18 の FAIL 行（チェック名だけ）を比べる（l* はラウンド18 の新規）
cd /home/user/BOM/usertest/mid
for f in r18/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|l*) continue;; esac
  [ -f r17/out/$b ] || { echo "NEW $b $(tail -1 $f)"; continue; }
  a=$(grep '^FAIL' r17/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t17=$(tail -1 r17/out/$b); t18=$(tail -1 $f)
  if [ "$a" != "$c" ]; then echo "DIFF $b r17[$t17] r18[$t18]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
