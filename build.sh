#!/usr/bin/env bash

#------------------------------------------------------------------------------
# @file
# 终极精简且支持缓存优化的构建脚本
#------------------------------------------------------------------------------

set -euo pipefail

build_temp_dir=""

cleanup() {
  if [[ -n "${build_temp_dir:-}" && -d "${build_temp_dir}" ]]; then
    rm -rf "${build_temp_dir}"
  fi
}

trap cleanup EXIT SIGINT SIGTERM

main() {

  GO_VERSION=1.26.3
  HUGO_VERSION=0.163.0

  export TZ=Europe/Oslo

  # 核心改动：在项目根目录下定义缓存基础目录
  # Cloudflare 在构建结束时会自动打包并上传项目根目录下的 .cache 文件夹
  CACHE_DIR="$(pwd)/.cache"
  mkdir -p "${CACHE_DIR}/local/bin"

  # 将所有工具的安装和各种包管理器的缓存路径全部重定向到该目录下
  export UV_INSTALL_DIR="${CACHE_DIR}/local/bin"
  export UV_CACHE_DIR="${CACHE_DIR}/uv"
  export GOCACHE="${CACHE_DIR}/go-build"
  export HUGO_CACHEDIR="${CACHE_DIR}/hugo-cache"

  # 更新 PATH，让系统优先读取项目根目录缓存中的二进制文件
  export PATH="${CACHE_DIR}/local/bin:${CACHE_DIR}/local/go/bin:${CACHE_DIR}/local/hugo:${PATH}"

  # 0. 检查并安装 uv
  if [ ! -f "${CACHE_DIR}/local/bin/uv" ]; then
    echo "uv not found in cache. Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
  else
    echo "🎉 Found uv in cache, skipping installation."
  fi

  # 1. 检查并安装 Go 与 Hugo
  if [ ! -f "${CACHE_DIR}/local/go/bin/go" ] || [ ! -f "${CACHE_DIR}/local/hugo/hugo" ]; then
    build_temp_dir=$(mktemp -d)
    pushd "${build_temp_dir}" > /dev/null

    if [ ! -f "${CACHE_DIR}/local/go/bin/go" ]; then
      echo "Go not found in cache. Installing Go ${GO_VERSION}..."
      curl -sLJO "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
      mkdir -p "${CACHE_DIR}/local"
      tar -C "${CACHE_DIR}/local" -xf "go${GO_VERSION}.linux-amd64.tar.gz"
    fi

    if [ ! -f "${CACHE_DIR}/local/hugo/hugo" ]; then
      echo "Hugo Extended not found in cache. Installing Hugo Extended ${HUGO_VERSION}..."
      curl -sLJO "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
      mkdir -p "${CACHE_DIR}/local/hugo"
      tar -C "${CACHE_DIR}/local/hugo" -xf "hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
    fi

    popd > /dev/null
  else
    echo "🎉 All tools (Go, Hugo) found in cache, skipping downloads."
  fi

  # 验证依赖
  echo "Verifying installations..."
  echo Go: "$(go version)"
  echo Hugo: "$(hugo version)"

  # 2. 配置 Git
  echo "Configuring Git..."
  git config core.quotepath false
  if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then
    git fetch --unshallow
  fi

  # 3. 克隆生成器
  if [ -d "generator" ]; then
    rm -rf generator
  fi
  echo "Cloning website-generator repository..."
  git clone https://github.com/CollegesChat/website-generator.git generator

  # 4. 运行 Python 脚本生成 Markdown (此时 uv 会自动命中并在 .cache/uv 下读写缓存)
  echo "Building Markdown files with uv..."
  export SITE_DIR="$(pwd)"
  export LOGURU_LEVEL="WARNING"
  export LOGURU_COLORIZE=False
  pushd generator > /dev/null
  wget https://github.com/CollegesChat/china-university-list/releases/latest/download/output.csv
  cat output.csv >> ./required/colleges.csv
  uv sync
  uv run python main.py
  popd > /dev/null

  # 5. 注入时间戳
  echo "Injecting current build time into hugo.yaml..."
  BUILD_TIME=$(TZ='Asia/Shanghai' date +'%Y-%m-%d %H:%M:%S')
  COPYRIGHT_STR="<a href='https://creativecommons.org/licenses/by-nc-sa/4.0/' target='_blank' rel='noopener'>CC BY-NC-SA 4.0</a> | Generated on ${BUILD_TIME} (UTC+8)"
  sed -i "s#copyright: \"\$copyright\"#copyright: \"${COPYRIGHT_STR}\"#g" hugo.yaml

  # 6. Hugo 编译
  echo "Building the static website with Hugo..."

  # 检查 Cloudflare 环境变量 CF_BASE_URL 是否存在
  if [[ -n "${CF_PAGES_URL:-}" ]]; then
    echo "Found CF_PAGES_URL: ${CF_PAGES_URL}, overriding Hugo baseURL."
    hugo build --gc --minify -d public -b "${CF_PAGES_URL}"
  else
    echo "CF_BASE_URL not set, using default baseURL from config file."
    hugo build --gc --minify -d public
  fi

  # 7. 清理静态文件
  echo "Cleaning up output folder..."
  pushd public > /dev/null
  rm -rf asciinema katex
  rm -f mermaid.min.js
  popd > /dev/null

  echo "Build completed successfully!"
}

main "$@"