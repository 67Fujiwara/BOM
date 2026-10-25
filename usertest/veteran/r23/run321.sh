cd /home/user/BOM/usertest/veteran/r23
for k in 2 1; do for p in 5197 5198; do BOM_URL=http://localhost:$p/ KEY=$k NROWS=${NROWS:-300} nice node 321-seq-latency.mjs >> 321-seq-latency.log 2>&1; done; done
echo done > run321.done
