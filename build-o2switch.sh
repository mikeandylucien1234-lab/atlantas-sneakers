#!/bin/bash
export PATH="/home/seje8726/nodevenv/atlantas-sneakers/22/bin:$PATH"
cd /home/seje8726/atlantas-sneakers

echo "Nettoyage..."
rm -rf .next
rm -rf node_modules
rm -f package-lock.json

echo "Installation des dépendances..."
npm install --prefer-offline

echo "Build..."
./node_modules/.bin/next build --webpack

echo "Terminé !"
