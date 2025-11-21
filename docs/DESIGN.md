## Env Marker — 設計・アーキテクチャ

このドキュメントは本拡張の主要設計決定、メッセージングフロー、マッチングロジック、テスト方法を簡潔にまとめたものです。

### 目的
- 指定したURLやIPアドレスにマッチした際に、ページ上に視覚的なマーカー（帯 / フレーム / リボン 等）を表示する。

### 主要コンポーネント
- `entrypoints/background.ts`
  - `chrome.webRequest.onCompleted` で接続先 `remoteIp` を受け取り、保存されたプロファイルのパターンと照合します。
  - パターン判定には `src/ipMatcher.ts` の `matchesPattern(pattern, remoteIp, url)` を使用します。
  - マッチが見つかれば該当タブに `{ type: 'show-env-marker-banner', ... }` メッセージを送信します。

- `entrypoints/content.ts`
  - `document_start` で常駐し、`evaluatePatternsAndShow()` を起動して現在の `location.href` と `chrome.storage` の設定を照合します。
  - `chrome.runtime.onMessage` と `chrome.storage.onChanged` を監視し、設定変更やオプション更新時に既存バナーを更新します（タブのリロード不要）。
  - `showBanner()` は一旦 `visibility: hidden` で要素を作成し、スタイル適用後に `visibility: visible` にしてチラつきを防ぎます。

- `src/ipMatcher.ts`
  - 中央集約されたパターンマッチャー。
  - サポート内容:
    - IPv4 / IPv6 の生データに対する部分一致
    - IPv6 の正規化（省略表記の展開など）
    - CIDR 表記の判定（BigIntを使ったプレフィックス比較）
    - ワイルドカード（`*`）を含むパターン
    - URL 部分一致のためのフォールバック正規表現

### 設計上の主要判断
- 動的スクリプト注入（`scripting`）は採用しない
  - 理由: 追加の権限が必要であり、manifest 登録済みの content script + メッセージングで十分に対応可能であるため。
  - 結果: `manifest.json`（`wxt.config.ts`）から `scripting` を除去し、必要最小限の権限に抑えています。

- 設定変更の即時反映
  - `options` ページで保存操作を行うと、`chrome.tabs.sendMessage(tab.id, { type: 'env-marker-settings-changed' })` を全タブに送り、content 側で再評価・更新を行います。
  - これによりタブリロード無しで設定変更が即時反映されます。

### メッセージ形式（主なもの）
- background → content: `{ type: 'show-env-marker-banner', profileId, text, color, position, size }`
- options → content: `{ type: 'env-marker-settings-changed' }`（受信側は `storage` を読み直して再評価）

### テスト方法（ローカル）
1. 依存をインストール: `pnpm install`
2. ビルド: `pnpm build`
3. Chrome の拡張機能管理（chrome://extensions）でデベロッパーモードを ON にし、`.output/chrome-mv3` を読み込む
4. `entrypoints/options/index.ts` から設定を保存し、開いているタブで設定が反映されることを確認する

ユニットテスト（IPv6/CIDR/ワイルドカードの検証）:
 - プロジェクトに Vitest ベースのテストが含まれています。`pnpm test` を実行してください。

### 注意点 / 将来の改善案
- 大量のタブが開いている場合、`tabs.sendMessage` をループで実行すると負荷がかかる可能性があります。必要ならば「変更対象タブの絞り込み」や「差分のみ送信する」最適化を検討してください。
- 現状は content 側で保存された全プロファイルを再評価します。差分更新（changed keys のみ適用）を実装すると負荷と処理時間を削減できます。

---

このファイルは短く整理した設計ノートです。詳細な実装（関数単位）を確認したい場合は、`src/ipMatcher.ts`、`entrypoints/background.ts`、`entrypoints/content.ts` を参照してください。
