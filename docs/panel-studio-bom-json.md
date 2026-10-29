# Panel Studio → BOM Pro（設計完了の部品表 JSON）

Panel Studio で「設計完了」すると、ZIP の中に **`<案件番号>_bom.json`** が入ります。
BOM Pro の **新規作成 → 「Panel Studio から取り込む」** にこの ZIP（または中の JSON）を選ぶと、
案件と部品の行（下書き）がまとめて入ります。

## 形式（UTF-8・JSON 1 つ）

```jsonc
{
  "format": "panel-studio/bom",   // これ以外なら読まない
  "version": 1,
  "exportedAt": "2026-10-29T08:00:00.000Z",
  "job": { "company": "〇〇株式会社", "jobNo": "A123456", "owner": "山田", "completedAt": "2026-10-29", "note": "" },
  "deviceName": "検査装置 1号機",  // 装置名の候補（無ければ panel.name / panel.model）
  "panel": { "model": "RA20-1214-ENC" },
  "lines": [
    { "model": "MY4N-D2 DC24V", "maker": "オムロン", "name": "リレー", "qty": 4, "unit": "個", "source": "device" },
    { "model": "TS35 （必要長 1200mm）", "maker": "", "name": "DINレール", "qty": 2, "unit": "本", "source": "derived" }
  ]
}
```

- `lines` は Panel Studio の部品表（機器本体 `device` と、DIN レール・ダクトなどの派生部品 `derived`）と同じ中身です。
- 単位は 個 / 本 / m / セット / パック / 式。ほかの単位は「個」になります。
- 案件番号は BOM Pro では「英字＋数字」（例 `A123456`）です。形式が合わないときは取り込み前の画面で直せます。
- 同じ案件番号がすでにあれば、その案件に行を足します（同じメーカー・型式の行は飛ばします）。完了案件には入れません。
- 取り込んだ行は **下書き**（調達区分は相見積）です。設計が内容を見て公開すると購買に渡ります。
