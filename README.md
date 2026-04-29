# 楽待 収益物件ビューア

楽待（rakumachi.jp）の収益物件一覧を毎日自動収集し、GitHub Pages で閲覧・Excel出力できるサイトです。

## セットアップ手順

### 1. このリポジトリを GitHub に作成

```bash
git remote add origin https://github.com/YOUR_NAME/rakumachi-viewer.git
git push -u origin main
```

### 2. GitHub Pages を有効化

1. リポジトリの **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. **Save**

→ `https://YOUR_NAME.github.io/rakumachi-viewer/` でサイトが公開されます

### 3. GitHub Actions の権限設定

1. **Settings** → **Actions** → **General**
2. **Workflow permissions** → **Read and write permissions** を選択
3. **Save**

### 4. 初回クローリング

- Actions タブ → **Crawl Rakumachi Properties** → **Run workflow**
- 完了後、`data/latest.json` がコミットされ、サイトに反映されます
- 以降は毎日 03:00 JST（18:00 UTC）に自動実行

## ローカルでの試走

```bash
cd scripts
npm install
npx playwright install chromium

# 1ページのみで動作確認
MAX_PAGES=1 node crawler.js

# 別の検索条件URLを使う場合
BASE_URL='https://www.rakumachi.jp/syuuekibukken/area/prefecture/dimAll/?pref=13' node crawler.js
```

`../data/latest.json` と `../data/daily/{YYYY-MM-DD}.json` が出力されます。

## 環境変数

| 変数 | デフォルト | 説明 |
|---|---|---|
| `BASE_URL` | 全国全種別の一覧 | クロール対象URL（クエリ条件で絞込み可） |
| `MAX_PAGES` | `200` | 最大ページ数 |
| `DELAY_MS` | `1500` | ページ間ディレイ(ms) |

## データ構造

`data/latest.json`:

```json
{
  "date": "2026-04-29",
  "lastUpdated": "2026-04-29T07:40:08.000Z",
  "totalCount": 100,
  "source": "rakumachi.jp",
  "baseUrl": "...",
  "properties": [
    {
      "id": "3610489",
      "name": "...",
      "type": "区分マンション",
      "prefecture": "東京都",
      "address": "...",
      "trafficLine": "...", "trafficStation": "...", "trafficWalkMin": 5,
      "priceMan": 2590, "priceLabel": "2590万円",
      "yieldPct": 9.29, "yieldLabel": "9.29%",
      "builtYear": 1986, "buildingAgeYears": 40,
      "structure": "RC造", "structureRaw": "RC造",
      "exclusiveAreaM2": 21.38, "buildingAreaM2": null, "landAreaM2": null,
      "broker": "...", "url": "https://www.rakumachi.jp/.../show.html",
      "crawledAt": "2026-04-29T..."
    }
  ]
}
```
