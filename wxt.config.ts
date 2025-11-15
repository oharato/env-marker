import { defineConfig } from 'wxt';
import pkg from './package.json';

export default defineConfig({
  manifest: {
    name: 'Env Marker',
    version: pkg.version,
    description: '指定したURLやIPアドレスのサイトに目印をつけます',
    permissions: ['storage', 'webRequest'],
    icons: {
      '16': 'icon16.png',
      '48': 'icon48.png',
      '128': 'icon128.png',
    },
    action: {
      default_title: 'Env Marker',
      default_popup: 'options.html', // エントリーポイントとして扱う
      default_icon: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png',
      },
    },
    background: {
      service_worker: 'background.js', // エントリーポイントとして扱う
      type: 'module',
    },
    options_page: 'options.html', // エントリーポイントとして扱う
    host_permissions: ['<all_urls>'],
  },
  // エントリーポイントの自動検出を有効にする
  // wxt は `entrypoints` ディレクトリ内のファイルを自動的に検出します
  // background.ts, content.ts, options/index.html など
  entrypointsDir: 'entrypoints',
});
