"""Status App"""
import os
import sqlite3
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DB = "data.db"


def init_db():
    """创建 statuses 表（如不存在）"""
    with sqlite3.connect(DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS statuses (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                battery    INTEGER NOT NULL DEFAULT 50,
                alertness  INTEGER NOT NULL DEFAULT 50,
                fullness   INTEGER NOT NULL DEFAULT 50,
                mood       INTEGER NOT NULL DEFAULT 50,
                message    TEXT    DEFAULT NULL,
                created_at TEXT    DEFAULT (datetime('now'))
            )
        """)


def get_db():
    """获取数据库连接，启用 Row 工厂"""
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn


with app.app_context():
    init_db()


# ─── API ────────────────────────────────────────────

@app.route("/api/status", methods=["POST"])
def submit_status():
    """接收她发来的状态"""
    data = request.get_json(force=True)
    battery   = max(0, min(100, int(data.get("battery", 50))))
    alertness = max(0, min(100, int(data.get("alertness", 50))))
    fullness  = max(0, min(100, int(data.get("fullness", 50))))
    mood      = max(0, min(100, int(data.get("mood", 50))))
    message   = (data.get("message") or "").strip()[:500] or None

    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO statuses (battery, alertness, fullness, mood, message) "
            "VALUES (?,?,?,?,?)",
            (battery, alertness, fullness, mood, message),
        )
        conn.commit()
        new_id = cur.lastrowid

    return jsonify({"ok": True, "id": new_id}), 201


@app.route("/api/status/latest")
def latest_status():
    """返回最新一条记录"""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM statuses ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return jsonify({"ok": True, "status": None})
    return jsonify({"ok": True, "status": dict(row)})


@app.route("/api/status/history")
def history():
    """分页返回历史记录"""
    limit  = request.args.get("limit",  50, type=int)
    before = request.args.get("before", None, type=int)

    with get_db() as conn:
        if before is not None:
            rows = conn.execute(
                "SELECT * FROM statuses WHERE id < ? ORDER BY id DESC LIMIT ?",
                (before, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM statuses ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()

    results = [dict(r) for r in rows]
    has_more = len(results) == limit
    return jsonify({"ok": True, "history": results, "has_more": has_more})


# ─── 页面 ────────────────────────────────────────────

@app.route("/")
def her_page():
    """她的输入页"""
    return render_template("index.html")


@app.route("/dashboard")
def his_page():
    """他的仪表盘"""
    return render_template("dashboard.html")


# ─── 启动 ────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5200))
    app.run(host="0.0.0.0", port=port, debug=True)
