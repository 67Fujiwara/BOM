#!/bin/bash
# r21 と r22 の FAIL 行（チェック名だけ）を比べる（n*・o* はそれぞれラウンド20・21 の新規なので除く）
cd /home/user/BOM/usertest/mid
for f in r22/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|n[0-9]*|o[0-9]*) continue;; esac
  [ -f r21/out/$b ] || { echo "NEW $b $(grep '^== ' $f | tail -1)"; continue; }
  a=$(grep '^FAIL' r21/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t20=$(grep "^== " r21/out/$b | tail -1); t21=$(grep "^== " $f | tail -1)
  if [ "$a" != "$c" ]; then echo "DIFF $b r21[$t20] r22[$t21]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
