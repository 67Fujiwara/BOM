#!/bin/bash
cd /home/user/BOM/usertest/veteran/r10
echo "start $(date +%T) $(uptime)" > batch3.status
SIZE=2500 TAG=-2500b timeout 3000 node r9-13-latency-ab.mjs > 13-latency-ab-2500b.log 2>&1; echo "2500 rc=$? $(date +%T) $(uptime)" >> batch3.status
SIZE=300 MODES=plain,holidays TAG=-300b timeout 2000 node r9-13-latency-ab.mjs > 13-latency-ab-300b.log 2>&1; echo "300 rc=$? $(date +%T) $(uptime)" >> batch3.status
echo DONE >> batch3.status
