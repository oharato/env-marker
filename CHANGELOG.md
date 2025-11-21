# Changelog

## 2025-11-21 — 変更要約

- `ipMatcher` を導入し、IPv6 正規化、CIDR マッチ、ワイルドカードをサポートする共通マッチロジックを `src/ipMatcher.ts` に集約しました。
- バックグラウンドとコンテントでマッチロジックを共有することで挙動の一貫性を確保しました。
- `scripting` 権限による動的注入を廃止し、manifest 登録済みの content script + `chrome.runtime` メッセージングと `chrome.storage.onChanged` で設定変更を反映する方式に変更しました（タブの自動リロードは行いません）。
- `showBanner()` の作成時に `visibility: hidden` を用いることで、バナー表示のチラつきを抑制しました。
- オプション保存時のタブのリロードを廃止し、`tabs.sendMessage` による通知で既存タブを更新するようにしました。

## 以前のリリース
- ここに過去の変更履歴を追加してください。
