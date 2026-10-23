#!/bin/bash
cd /home/user/BOM/usertest/mid/r14
run() { timeout 600 node $1 $2 > out/$3.out 2>&1; echo "$3 $(tail -1 out/$3.out)"; }
( run b1.mjs all b1-all; run b1.mjs min2 b1-min2; run b1.mjs deadline b1-deadline; run b2.mjs pick b2-pick ) &
( run b2.mjs quickfix b2-quickfix; run b3.mjs "" b3; run b4.mjs "" b4 ) &
( run b5.mjs "" b5; run b5.mjs reject b5-reject; run b6.mjs "" b6 ) &
( run b7.mjs "" b7; run b8.mjs "" b8; run b9.mjs "" b9 ) &
wait; echo DONE
