#!/usr/bin/env bash
set -e

# 1) 确保 nvm 在非交互环境也能用（PM2 重启/开机启动时很关键）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# 2) 固定用 Node 18
nvm use 18 >/dev/null

# 3) 加载环境变量
set -a
source .env.production
set +a

# 4) 启动 Next
npm start -- -p 3000
