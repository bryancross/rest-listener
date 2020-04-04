#!/usr/bin/env bash
npm install
echo "creating log directory"
mkdir -p log
echo "Running NPM install"
npm install
#echo "Patching node-github API"
#./script/patch-node-github.sh
clear
echo "****************************************************************"
echo
echo "Bootstrap complete"
echo
echo "****************************************************************"


