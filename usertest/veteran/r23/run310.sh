cd /home/user/BOM/usertest/veteran/r23
BOM_URL=http://localhost:5197/ TAG=-5197 nice -n 6 node 310-wizard.mjs > 310-wizard-5197.log 2>&1
BOM_URL=http://localhost:5198/ TAG=-5198 nice -n 6 node 310-wizard.mjs > 310-wizard-5198.log 2>&1
echo done > run310.done
