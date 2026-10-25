cd /home/user/BOM/usertest/veteran/r23
while [ ! -f run242.done ]; do sleep 10; done
for s in 180-redos-scan 199-redos-scan2 220-redos-section; do
  ( export NN=80000; nice -n 6 ./probe.sh $s.ts head >/dev/null 2>&1 ); mv $s.log $s-80000.log
done
echo done > run80k.done
