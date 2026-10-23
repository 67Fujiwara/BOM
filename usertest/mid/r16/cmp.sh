#!/bin/bash
# r15 と r16 の FAIL 行（チェック名だけ）を比べる
cd /home/user/BOM/usertest/mid
for f in r16/out/*.out; do b=$(basename $f); case $b in *-run2.out|*-run3.out|j*) continue;; esac
  [ -f r15/out/$b ] || { echo "NEW $b $(tail -1 $f)"; continue; }
  a=$(grep '^FAIL' r15/out/$b | sed 's/ :: .*//' | sort); c=$(grep '^FAIL' $f | sed 's/ :: .*//' | sort)
  t15=$(tail -1 r15/out/$b); t16=$(tail -1 $f)
  if [ "$a" != "$c" ]; then echo "DIFF $b r15[$t15] r16[$t16]"; diff <(echo "$a") <(echo "$c") | sed 's/^/   /'; fi
done
