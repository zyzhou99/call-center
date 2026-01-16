#!/usr/bin/env bash
set -e

cd /home/ubuntu/call-center

# 明确一下端口
export PORT=3000

# dev 模式启动 Next.js（会自己把 NODE_ENV 设成 development）
npm run dev
