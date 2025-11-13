import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Env Marker',
    version: '1.0', // package.json の version を使うことも可能
    description: '指定したURLやIPアドレスのサイトに目印をつけます',
    permissions: ['storage', 'webRequest'],
    action: {
      default_title: 'Env Marker',
      default_popup: 'options.html', // エントリーポイントとして扱う
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
