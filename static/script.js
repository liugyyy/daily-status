/** Status App — frontend */

var PATH  = window.location.pathname;
var IS_DASHBOARD = PATH === '/dashboard';
var POLL_INTERVAL = 10_000; // 10 秒

/* ==================== 通用 ==================== */

function showToast(msg) {
    var toast = document.querySelector('.toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function () { toast.classList.remove('show'); }, 2500);
}

/* ==================== 她的输入页 ==================== */

function initInputPage() {
    var sliders = document.querySelectorAll('input[type="range"]');
    sliders.forEach(function (slider) {
        var valSpan = slider.parentNode.querySelector('.slider-value');
        slider.addEventListener('input', function () {
            valSpan.textContent = slider.value + '%';
        });
    });

    var btn = document.querySelector('.btn-submit');
    var sentEl = document.querySelector('.sent-time');

    btn.addEventListener('click', function () {
        var data = {};
        ['battery','alertness','fullness','mood'].forEach(function (key) {
            data[key] = parseInt(document.getElementById('slider-' + key).value, 10);
        });
        data.message = document.querySelector('.message-input').value.trim() || null;

        // 如果 message 是空字符串，设 null（不传）
        if (data.message === '') data.message = null;

        btn.textContent = '发送中…';
        btn.disabled = true;

        fetch('/api/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })
        .then(function (r) { return r.json(); })
        .then(function () {
            btn.classList.add('success');
            btn.textContent = '已发送 ✓';

            var now = new Date();
            var timeStr = String(now.getHours()).padStart(2,'0')
                        + ':' + String(now.getMinutes()).padStart(2,'0');
            sentEl.textContent = '刚才发送于 ' + timeStr + ' ✨';
            sentEl.classList.add('visible');

            setTimeout(function () {
                btn.classList.remove('success');
                btn.textContent = '发送';
                btn.disabled = false;
            }, 2000);
        })
        .catch(function () {
            btn.textContent = '发送';
            btn.disabled = false;
            showToast('发送失败，再试一下？');
        });
    });
}

/* ==================== 他的仪表盘 ==================== */

function initDashboard() {
    var latestId = 0;

    function fetchLatest() {
        fetch('/api/status/latest')
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.ok || !res.status) return;
                var s = res.status;
                if (s.id === latestId) return; // 无更新
                latestId = s.id;
                updateCards(s);
                updateMessage(s.message);
                var refreshEl = document.querySelector('.refresh-time');
                if (refreshEl) refreshEl.textContent = '更新于 ' + formatTime(s.created_at);
            })
            .catch(function () { /* 静默等待 */ });
    }

    function updateCards(s) {
        ['battery','alertness','fullness','mood'].forEach(function (key) {
            var valEl = document.getElementById('val-' + key);
            var barEl = document.getElementById('bar-' + key);
            if (valEl) valEl.textContent = s[key] + '%';
            if (barEl) barEl.style.width = s[key] + '%';
        });
    }

    function updateMessage(msg) {
        var card = document.getElementById('message-card');
        var text = document.getElementById('message-text');
        if (msg && card && text) {
            text.textContent = msg;
            card.style.display = 'block';
        } else if (card) {
            card.style.display = 'none';
        }
    }

    function loadHistory(beforeId) {
        var url = '/api/status/history?limit=30';
        if (beforeId) url += '&before=' + beforeId;

        fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (res) {
                if (!res.ok) return;
                var list = document.getElementById('history-list');
                if (!beforeId) list.innerHTML = '';

                if (!beforeId && res.history.length === 0) {
                    list.innerHTML = '<div class="empty-state">还没有记录哦，等她发第一条吧 💫</div>';
                    var btn = document.getElementById('btn-more');
                    if (btn) btn.style.display = 'none';
                    return;
                }

                res.history.forEach(function (item) {
                    var div = document.createElement('div');
                    div.className = 'history-item';
                    div.innerHTML =
                        '<span class="history-time">' + formatTime(item.created_at) + '</span>'
                      + '<span class="history-bars">'
                      +   '<span class="history-bar battery"><span class="history-bar-inner" style="width:'
                          + item.battery + '%"></span></span>'
                      +   '<span class="history-bar alertness"><span class="history-bar-inner" style="width:'
                          + item.alertness + '%"></span></span>'
                      +   '<span class="history-bar fullness"><span class="history-bar-inner" style="width:'
                          + item.fullness + '%"></span></span>'
                      +   '<span class="history-bar mood"><span class="history-bar-inner" style="width:'
                          + item.mood + '%"></span></span>'
                      + '</span>'
                      + (item.message
                          ? '<span class="history-msg" title="' + escapeHtml(item.message) + '">'
                            + escapeHtml(item.message) + '</span>'
                          : '');
                    list.appendChild(div);
                });

                var btn = document.getElementById('btn-more');
                if (!res.has_more) {
                    if (btn) btn.style.display = 'none';
                } else if (btn) {
                    btn.style.display = 'block';
                    btn.dataset.before = res.history[res.history.length - 1].id;
                }
            })
            .catch(function () { /* 静默 */ });
    }

    // 初始加载
    fetchLatest();
    loadHistory(null);

    // 定时轮询
    setInterval(fetchLatest, POLL_INTERVAL);

    // 加载更多按钮
    var moreBtn = document.getElementById('btn-more');
    if (moreBtn) {
        moreBtn.addEventListener('click', function () {
            var beforeId = parseInt(this.dataset.before, 10);
            if (beforeId) loadHistory(beforeId);
        });
    }
}

function formatTime(t) {
    if (!t) return '';
    // SQLite datetime 格式: "2026-06-09 15:32:00"
    var parts = t.split(' ');
    return parts.length > 1 ? parts.pop() : t;
}

function escapeHtml(s) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(s));
    return div.innerHTML;
}

/* ==================== 入口 ==================== */

if (IS_DASHBOARD) {
    initDashboard();
} else {
    initInputPage();
}
