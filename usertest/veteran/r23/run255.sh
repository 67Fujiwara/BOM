cd /home/user/BOM/usertest/veteran/r23
for s in 231-removed-supplier 252-supplied-ball 255-designated-removed 255b-designated-problems; do for w in head r22b; do nice -n 6 ./probe.sh $s.ts $w >/dev/null 2>&1; done; done
echo done > run255.done
