#!/bin/zsh
# Deploy the static site to Cloudflare Pages (project: swarga-by-the-bay).
set -e
cd "$(dirname "$0")"
rm -rf .cf-dist && mkdir .cf-dist
cp index.html admin.html _headers .cf-dist/
cp -R assets .cf-dist/assets
npx -y wrangler@4 pages deploy .cf-dist --project-name swarga-by-the-bay --branch main --commit-dirty=true
rm -rf .cf-dist
