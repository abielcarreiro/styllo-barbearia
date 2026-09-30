#!/bin/sh
# Monta a pasta dist/ publicada no Cloudflare Pages.
# Copia tudo, menos o que é interno do projeto.
set -e
rm -rf dist
mkdir dist
for item in *; do
  case "$item" in
    supabase|dist|build.sh|README.md|node_modules) ;;
    *) cp -R "$item" dist/ ;;
  esac
done
echo "dist/ pronta:"
ls dist
