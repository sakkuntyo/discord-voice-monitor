# discord-voice-monitor

Discord のボイスチャンネル参加者と発声状況を、BetterDiscord plugin 経由で Electron ウィンドウに表示する小さなモニターです。

<img width="503" height="504" alt="image" src="https://github.com/user-attachments/assets/e02affc0-8aae-4a2a-9fd5-c2eab1035931" />


## 構成

- `electron/`
  Electron 側の表示アプリです。
- `betterdiscord/VoiceStateBridge.plugin.js`
  BetterDiscord から VC 参加者と speaking 状態をローカル WebSocket に送る plugin です。
- `vencord-userplugin/voiceStateBridge.ts`
  Vencord 向けの試作 userplugin です。

## 使い方

### 1. Electron アプリを起動

```bash
npm install
npm start
```

Electron アプリは `ws://127.0.0.1:3939` を待ち受けます。

### 2. BetterDiscord plugin を入れる

BetterDiscord の `Plugins` 画面で `Open Plugins Folder` を開き、次のファイルを配置して有効化します。

```text
betterdiscord/VoiceStateBridge.plugin.js
```

### 3. Discord で VC に参加

VC に入ると Electron 側に次の情報が表示されます。

- 接続中のボイスチャンネル
- 参加メンバー一覧
- 発声中メンバー数
- 各メンバーの speaking 状態

## メモ

- BetterDiscord plugin は 200ms ポーリングで状態を更新します。
- WebSocket はローカル用途を前提にしています。
- UI は Electron 側で Overlay / Debug 向けに調整できます。
