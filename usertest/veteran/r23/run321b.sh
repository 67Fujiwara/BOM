cd /home/user/BOM/usertest/veteran/r23
for p in 5197 5198; do BOM_URL=http://localhost:$p/ KEY=2 NROWS=800 nice node 321-seq-latency.mjs >> 321b-seq-latency.log 2>&1; done
echo done > run321b.done
