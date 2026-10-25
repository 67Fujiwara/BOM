#!/bin/bash
cd /home/user/BOM/usertest/veteran/r22
while ! grep -q DONE batchW2.status 2>/dev/null; do sleep 10; done
bash batchH22.sh
