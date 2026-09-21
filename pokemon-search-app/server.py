#!/usr/bin/env python3
"""静的ファイル配信 + Gemini API プロキシ。

APIキーはクライアントに埋め込まず、サーバー側の環境変数 GEMINI_API_KEY のみから読む。
使い方:
  GEMINI_API_KEY=xxxx python3 server.py
  ブラウザで http://localhost:8080/ を開く
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "8080"))
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_POST(self) -> None:
        if self.path.split("?", 1)[0] != "/api/gemini-suggest":
            self.send_error(404, "Not Found")
            return
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self._json(400, {"error": "リクエストのJSONを解釈できませんでした。"})
            return
        self._handle_gemini(payload)

    def _handle_gemini(self, payload: dict) -> None:
        api_key = os.environ.get("GEMINI_API_KEY", "").strip()
        if not api_key:
            self._json(
                503,
                {
                    "error": "GEMINI_API_KEY が未設定です。サーバー起動時に環境変数で渡してください。"
                    "数値比較自体はこの画面内で完結しており、AIは説明文生成のみに使います。"
                },
            )
            return

        prompt = (
            "あなたはポケモンHGSSのバトルファクトリー用アドバイザーです。"
            "次のJSONはクライアント側ロジックが算出した数値比較結果です。"
            "数値の再計算や改変はせず、この数値だけを根拠に日本語で短く推奨コメントを書いてください。"
            "結論(交換すべきか、どの枠と交換すべきか)を先に述べ、続けてタイプの穴と実数値の差を理由にしてください。\n\n"
            + json.dumps(payload, ensure_ascii=False)
        )
        body = json.dumps(
            {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.3, "maxOutputTokens": 512},
            }
        ).encode("utf-8")
        last_error = None
        data = None
        for attempt in range(3):
            req = urllib.request.Request(
                f"{GEMINI_ENDPOINT}?key={api_key}",
                data=body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=90) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                last_error = None
                break
            except urllib.error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="replace")
                last_error = f"Gemini APIエラー({exc.code}): {detail[:300]}"
                if exc.code in (429, 503) and attempt < 2:
                    time.sleep(2 * (attempt + 1))
                    continue
                self._json(502, {"error": last_error})
                return
            except Exception as exc:  # noqa: BLE001 - ローカル個人用サーバーなので広く捕捉
                self._json(502, {"error": f"Gemini APIへの接続に失敗しました: {exc}"})
                return
        if data is None:
            self._json(502, {"error": last_error or "Gemini APIへの接続に失敗しました。"})
            return

        comment = ""
        try:
            comment = data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            comment = ""
        if not comment:
            self._json(502, {"error": "Gemini APIからコメントを取得できませんでした。"})
            return
        self._json(200, {"comment": comment})

    def _json(self, status: int, obj: dict) -> None:
        encoded = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving on http://0.0.0.0:{PORT}/  (Gemini key set: {bool(os.environ.get('GEMINI_API_KEY'))})")
    httpd.serve_forever()


if __name__ == "__main__":
    main()
