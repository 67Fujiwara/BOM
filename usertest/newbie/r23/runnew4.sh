#!/bin/bash
# r22 の解析スクリプト（q01〜q17：旧は既定の 56e5aba）と、引数つきの画面スクリプトを r23 で再実行
cd /home/user/BOM/usertest/newbie/r23
for s in q01_paren_matrix q02_paren_en q03_phrases q04_arrow_ordinary q05_kind q06_delim q07_dnp q08_kind_vocab q09_changecol q10_newmodel q12_csv_realistic q13_samewords q14_qty_values q15_arrow_markers q17_kindvals_hold q18_carry; do
  [ -f $s.mjs ] && { timeout 900 node $s.mjs > results/$s.stdout 2>&1; echo "exit $? $s" >> results/_progress_q.txt; }
done
timeout 900 node q11_ordinary_fuzz.mjs > results/q11_ordinary_fuzz.stdout 2>&1; echo "exit $? q11_ordinary_fuzz" >> results/_progress_q.txt
OLD=688ceb6 timeout 900 node q11_ordinary_fuzz.mjs > results/q11_ordinary_fuzz_688ceb6.stdout 2>&1; echo "exit $? q11_688" >> results/_progress_q.txt
bash ./run_param21.sh
echo ALLDONE >> results/_progress_q.txt
