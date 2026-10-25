cd /home/user/BOM/usertest/veteran/r23
for w in head r22b; do ( export NN=80000; nice -n 6 ./probe.sh 242-redos-new.ts $w >/dev/null 2>&1 ); s=""; [ $w = r22b ] && s=-r22b; mv 242-redos-new$s.log 242-redos-new-80000$s.log; done
echo done > run242.done
