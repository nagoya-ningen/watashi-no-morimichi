/* ============================================================
   わたしの森道 — アプリ本体
============================================================ */
(function () {
  'use strict';

  const state = {
    view: 'myplan',
    /* ヘッダーの日付タブで「自分が行った日」を複数選択した結果（dayId の配列）。
       0〜3 件すべて許容され、画像シェアにのみ反映される。
       出店一覧の shopDay フィルタ／アーティストの artistDay フィルタとは別物。 */
    attendedDays: load('mm2026_attended_days', []),
    artistQuery: '', artistDay: 'all',
    shopQuery: '', shopZone: 'all',
    /* 出店ショップの出店日フィルタ。'all'=全日。d1/d2/d3=その日に出店する店のみ。
       同一ブース番号で日替わりに店舗が入れ替わる出店（種と旅と・モリミチ喫茶室・
       ウキウキ通り 18-20 など）を正しく絞り込むために必須。 */
    shopDay: 'all',
    myplanTab: 'shops',
    /* マイプラン「めぐった出店」内の第2層タブ。
       visited=行った / nextyear=来年行きたい
       （wishlist は UI から廃止。state.fav.shops データは互換性のため保持。） */
    myplanShopSubTab: 'visited',
    fav: load('mm2026_fav', { artists: [], shops: [] }),
    checks: load('mm2026_checks', {}),
    recent: load('mm2026_recent', { shops: [], artists: [] }),
    /* 行った出店IDの配列（fav と独立）。✅ 訪問チェック用。 */
    visited: load('mm2026_visited', []),
    /* 来年行きたい出店IDの配列（出店のみ。アーティストは毎年変わるため対象外） */
    nextYear: load('mm2026_nextyear', []),
    /* 出店ごとのメモ。{shopId: {tags: string[], body: string, updatedAt: number}} */
    notes: load('mm2026_notes', {}),
    night: initNight()
  };
  /* 夜モード初期値：保存値があれば優先、無ければ端末のダークモード設定に従う。
     localStorage が使えない環境でも落ちないよう try/catch で包む。 */
  function initNight() {
    try {
      const v = localStorage.getItem('mm2026_night');
      if (v === '1') return true;
      if (v === '0') return false;
    } catch (e) {}
    try { return window.matchMedia('(prefers-color-scheme:dark)').matches; }
    catch (e) { return false; }
  }

  function load(k, def) {
    try { const r = JSON.parse(localStorage.getItem(k)); return r == null ? def : r; }
    catch (e) { return def; }
  }
  /* localStorage は iOS プライベートモード・容量超過で throw する。
     失敗してもアプリは止めない（メモリ上の状態は保持される）。 */
  function save(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); }
    catch (e) { /* 保存不可でも継続 */ }
  }
  /* 破損・型崩れした localStorage 値で初期化が落ちるのを防ぐ */
  function sanitizeState() {
    const f = state.fav;
    if (!f || typeof f !== 'object' || !Array.isArray(f.artists) || !Array.isArray(f.shops))
      state.fav = { artists: [], shops: [] };
    if (!state.checks || typeof state.checks !== 'object' || Array.isArray(state.checks))
      state.checks = {};
    const r = state.recent;
    if (!r || typeof r !== 'object' || !Array.isArray(r.shops) || !Array.isArray(r.artists))
      state.recent = { shops: [], artists: [] };
    if (!Array.isArray(state.visited)) state.visited = [];
    if (!Array.isArray(state.nextYear)) state.nextYear = [];
    if (!state.notes || typeof state.notes !== 'object' || Array.isArray(state.notes))
      state.notes = {};
    /* attendedDays は dayId（'d1'/'d2'/'d3'）の文字列配列。
       破損データは要素単位で除外し、最終的に FESTIVAL.days に存在する id のみを残す。 */
    if (!Array.isArray(state.attendedDays)) {
      state.attendedDays = [];
    } else {
      const validIds = FESTIVAL.days.map(d => d.id);
      state.attendedDays = state.attendedDays.filter(
        x => typeof x === 'string' && validIds.indexOf(x) !== -1
      );
    }
  }
  /* 行った日（attendedDays）API — 出店の visited とは独立。
     画像シェアの「行った日」表記にのみ使う。 */
  function saveAttendedDays() { save('mm2026_attended_days', state.attendedDays); }
  function isAttended(dayId) { return state.attendedDays.indexOf(dayId) !== -1; }
  function toggleAttended(dayId) {
    const i = state.attendedDays.indexOf(dayId);
    if (i === -1) { state.attendedDays.push(dayId); }
    else { state.attendedDays.splice(i, 1); }
    saveAttendedDays();
  }
  /* 選択中の行った日を「5/22(金)・5/24(日)」形式の文字列で返す。
     0件なら空文字、複数件は FESTIVAL.days の元順を保って中黒で連結する。
     UI ／ テキストシェア向けの一般形。 */
  function attendedDaysText() {
    if (!state.attendedDays.length) return '';
    return FESTIVAL.days
      .filter(d => isAttended(d.id))
      .map(d => d.label + '(' + (DOW_JA[d.dow] || d.dow) + ')')
      .join('・');
  }
  /* 画像シェア用の短い表記。発行情報の「5.22 - 24」の表記と揃え、
     「5.22・5.24」形式で返す。 */
  function attendedDaysShort() {
    if (!state.attendedDays.length) return '';
    return FESTIVAL.days
      .filter(d => isAttended(d.id))
      .map(d => d.label.replace('/', '.'))
      .join('・');
  }
  function saveFav() { save('mm2026_fav', state.fav); }
  function isFav(t, id) { return state.fav[t].indexOf(id) !== -1; }
  function toggleFav(t, id) {
    const a = state.fav[t], i = a.indexOf(id);
    if (i === -1) { a.push(id); return true; }
    a.splice(i, 1); return false;
  }
  /* 行った（visited）API — fav と同じパターン。出店のみ。 */
  function saveVisited() { save('mm2026_visited', state.visited); }
  function isVisited(id) { return state.visited.indexOf(id) !== -1; }
  function toggleVisited(id) {
    const i = state.visited.indexOf(id);
    if (i === -1) { state.visited.push(id); return true; }
    state.visited.splice(i, 1); return false;
  }
  /* 来年行きたい（nextYear）API — 出店のみ。 */
  function saveNextYear() { save('mm2026_nextyear', state.nextYear); }
  function isNextYear(id) { return state.nextYear.indexOf(id) !== -1; }
  function toggleNextYear(id) {
    const i = state.nextYear.indexOf(id);
    if (i === -1) { state.nextYear.push(id); return true; }
    state.nextYear.splice(i, 1); return false;
  }
  /* ショップメモ API。{tags, body, updatedAt} を持つ。
     空オブジェクト相当（tags が空配列＆body が空文字）になったら state からも削除する。 */
  function saveNotes() { save('mm2026_notes', state.notes); }
  function getNote(id) {
    const n = state.notes[id];
    if (!n || typeof n !== 'object') return { tags: [], body: '', updatedAt: 0 };
    return {
      tags: Array.isArray(n.tags) ? n.tags : [],
      body: typeof n.body === 'string' ? n.body : '',
      updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : 0
    };
  }
  function setNote(id, obj) {
    /* タグは重複を排除しておく（インポート時の汚染データ対策も兼ねる） */
    const tags = Array.isArray(obj.tags) ? [...new Set(obj.tags.filter(t => typeof t === 'string'))] : [];
    /* 500字制限は「Unicode コードポイント単位」でカウントする。
       UTF-16 単位（s.length）だとサロゲートペアの絵文字が2でカウントされ、
       250 字付近で勝手に切られてしまうため。 */
    let body = typeof obj.body === 'string' ? obj.body : '';
    const arr = [...body];
    if (arr.length > 500) body = arr.slice(0, 500).join('');
    if (tags.length === 0 && body.length === 0) {
      delete state.notes[id];
    } else {
      state.notes[id] = { tags, body, updatedAt: Date.now() };
    }
  }
  /* 文字数カウント（コードポイント単位） */
  function noteBodyLen(body) {
    return typeof body === 'string' ? [...body].length : 0;
  }
  function hasNote(id) {
    const n = state.notes[id];
    return !!(n && ((Array.isArray(n.tags) && n.tags.length > 0) || (typeof n.body === 'string' && n.body.length > 0)));
  }
  /* メモ用の固定タグ。順序は表示順。 */
  const NOTE_TAGS = ['おすすめ', 'また来たい', '待ち時間注意', '売切れ早い', '写真映え'];
  /* このアプリの公開URL（シェア時に使う） */
  const APP_URL = 'https://nagoya-ningen.github.io/watashi-no-morimichi/';
  /* シェアヘルパ。Web Share API → clipboard.writeText → prompt の段階フォールバック。 */
  async function shareOrCopy({ title, text, url }) {
    const payload = { title, text, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return 'shared';
      }
    } catch (e) { /* ユーザーキャンセル等はサイレントに */ }
    /* Web Share 非対応 or キャンセル後 → クリップボードコピー */
    const composed = [text, url].filter(Boolean).join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(composed);
        toast('リンクをコピーしました');
        return 'copied';
      }
    } catch (e) {}
    /* 最終フォールバック：prompt で見せる */
    try { window.prompt('テキストをコピーしてください', composed); } catch (e) {}
    return 'fallback';
  }
  /* メモ入力の debounce 用 timer 保持 */
  let _noteSaveTimer = null;
  function scheduleSaveNotes(delay) {
    if (_noteSaveTimer) clearTimeout(_noteSaveTimer);
    _noteSaveTimer = setTimeout(() => { saveNotes(); _noteSaveTimer = null; }, delay || 500);
  }
  /* 'YYYY-MM-DD' + 'HH:MM' をローカル時刻の Date に（iOS Safari 互換のため
     文字列パースに頼らず数値引数で生成する） */
  function mkDate(dateStr, hm) {
    const p = String(dateStr).split('-').map(Number);
    const t = String(hm || '00:00').split(':').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1, t[0] || 0, t[1] || 0, 0);
  }
  function sameDate(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function todayDay() {
    const n = new Date();
    const d = FESTIVAL.days.find(x => sameDate(mkDate(x.date), n));
    return d ? d.id : null;
  }

  /* ---------- DOM ヘルパ ---------- */
  const $ = s => document.querySelector(s);
  const $$ = s => [].slice.call(document.querySelectorAll(s));
  function el(t, c, h) {
    const e = document.createElement(t);
    if (c) e.className = c;
    if (h != null) e.innerHTML = h;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  let toastT;
  function toast(m) {
    let t = $('#toast');
    if (!t) { t = el('div', 'toast'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = m; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2000);
  }
  function openUrl(u) { window.open(u, '_blank', 'noopener'); }
  function secTitle(jp, en) {
    return el('div', 'section-title',
      `<span>${esc(jp)}</span><span class="en">${esc(en)}</span>`);
  }

  /* 検索用の正規化キー：大小文字・全角半角・半角カナ・カタカナ/ひらがな・
     記号差を吸収し、スマホでの曖昧な入力でもヒットしやすくする。
     NFKC で半角カナ→全角カナ・全角英数→半角英数を一括変換する。 */
  function normKey(s) {
    var t;
    try { t = String(s).normalize('NFKC'); }
    catch (e) { t = String(s); }
    return t.toLowerCase()
      .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[　\s・･.,，、。\-‐-―ー~〜＆]/g, '');
  }

  /* ローマ字（ヘボン式・訓令式の主要パターン）→ひらがな簡易変換。
     英語名の店・アーティストを「ミナペルホネン」「みなぺるほねん」など
     カナで検索した時、normKey 同士の includes でぼんやり一致させるための
     補助キーを作る目的。完璧な変換は目指さず、主要50音＋濁音半濁音＋
     拗音＋促音＋撥音をカバーする。
     入力は normKey 通過後（lowercase / 記号除去済み）の文字列を想定。 */
  var ROMA_TABLE = [
    // 長い順に並べる（拗音・3字節を先にマッチさせる）
    ['kkya','っきゃ'],['kkyu','っきゅ'],['kkyo','っきょ'],
    ['ssha','っしゃ'],['sshu','っしゅ'],['ssho','っしょ'],['sshi','っし'],
    ['ccha','っちゃ'],['cchu','っちゅ'],['ccho','っちょ'],['cchi','っち'],
    ['ttsu','っつ'],['tsu','つ'],['tta','った'],['tte','って'],['tto','っと'],['tti','っち'],
    ['nnya','んにゃ'],['nnyu','んにゅ'],['nnyo','んにょ'],
    ['ppya','っぴゃ'],['ppyu','っぴゅ'],['ppyo','っぴょ'],
    ['kya','きゃ'],['kyu','きゅ'],['kyo','きょ'],['kyi','きぃ'],['kye','きぇ'],
    ['gya','ぎゃ'],['gyu','ぎゅ'],['gyo','ぎょ'],
    ['sha','しゃ'],['shu','しゅ'],['sho','しょ'],['she','しぇ'],['shi','し'],
    ['sya','しゃ'],['syu','しゅ'],['syo','しょ'],
    ['cha','ちゃ'],['chu','ちゅ'],['cho','ちょ'],['che','ちぇ'],['chi','ち'],
    ['tya','ちゃ'],['tyu','ちゅ'],['tyo','ちょ'],
    ['tha','てぁ'],['thi','てぃ'],['thu','てゅ'],['the','てぇ'],['tho','てょ'],
    ['nya','にゃ'],['nyu','にゅ'],['nyo','にょ'],
    ['hya','ひゃ'],['hyu','ひゅ'],['hyo','ひょ'],
    ['mya','みゃ'],['myu','みゅ'],['myo','みょ'],
    ['rya','りゃ'],['ryu','りゅ'],['ryo','りょ'],
    ['bya','びゃ'],['byu','びゅ'],['byo','びょ'],
    ['pya','ぴゃ'],['pyu','ぴゅ'],['pyo','ぴょ'],
    ['ja','じゃ'],['ju','じゅ'],['jo','じょ'],['je','じぇ'],['ji','じ'],
    ['jya','じゃ'],['jyu','じゅ'],['jyo','じょ'],
    ['zya','じゃ'],['zyu','じゅ'],['zyo','じょ'],
    ['dya','ぢゃ'],['dyu','ぢゅ'],['dyo','ぢょ'],
    ['fa','ふぁ'],['fi','ふぃ'],['fe','ふぇ'],['fo','ふぉ'],['fu','ふ'],['hu','ふ'],
    ['va','ヴぁ'],['vi','ヴぃ'],['vu','ヴ'],['ve','ヴぇ'],['vo','ヴぉ'],
    ['wa','わ'],['wi','うぃ'],['we','うぇ'],['wo','を'],['wu','う'],
    ['xa','ぁ'],['xi','ぃ'],['xu','ぅ'],['xe','ぇ'],['xo','ぉ'],
    ['ka','か'],['ki','き'],['ku','く'],['ke','け'],['ko','こ'],
    ['ga','が'],['gi','ぎ'],['gu','ぐ'],['ge','げ'],['go','ご'],
    ['sa','さ'],['si','し'],['su','す'],['se','せ'],['so','そ'],
    ['za','ざ'],['zi','じ'],['zu','ず'],['ze','ぜ'],['zo','ぞ'],
    ['ta','た'],['ti','ち'],['te','て'],['to','と'],
    ['da','だ'],['di','ぢ'],['du','づ'],['de','で'],['do','ど'],
    ['na','な'],['ni','に'],['nu','ぬ'],['ne','ね'],['no','の'],
    ['ha','は'],['hi','ひ'],['he','へ'],['ho','ほ'],
    ['ba','ば'],['bi','び'],['bu','ぶ'],['be','べ'],['bo','ぼ'],
    ['pa','ぱ'],['pi','ぴ'],['pu','ぷ'],['pe','ぺ'],['po','ぽ'],
    ['ma','ま'],['mi','み'],['mu','む'],['me','め'],['mo','も'],
    ['ya','や'],['yu','ゆ'],['yo','よ'],['yi','い'],['ye','いぇ'],
    ['ra','ら'],['ri','り'],['ru','る'],['re','れ'],['ro','ろ'],
    ['la','ら'],['li','り'],['lu','る'],['le','れ'],['lo','ろ'],
    ['a','あ'],['i','い'],['u','う'],['e','え'],['o','お'],
    ['n','ん']
  ];
  function romajiToKana(s) {
    if (!s) return '';
    /* 既に英字を含まない（=カナ/漢字のみ）なら変換不要 */
    if (!/[a-z]/.test(s)) return s;
    var src = s;
    var out = '';
    var i = 0;
    while (i < src.length) {
      var c = src.charAt(i);
      if (c < 'a' || c > 'z') {
        out += c;
        i++;
        continue;
      }
      /* 二重子音→促音（kk,ss,tt,pp,ll,mm,gg,bb,dd,ff,jj,rr,zz） */
      if (i + 1 < src.length && c === src.charAt(i + 1) &&
          'kstpgbdfjrlzm'.indexOf(c) !== -1 && c !== 'n') {
        /* 「ll」「mm」「rr」も実用上は促音化しない方が良いケースがあるが、
           includes 判定の上で誤検出より見落としを避ける */
        out += 'っ';
        i++;
        continue;
      }
      var matched = false;
      for (var k = 0; k < ROMA_TABLE.length; k++) {
        var pat = ROMA_TABLE[k][0];
        if (src.substr(i, pat.length) === pat) {
          /* 'n' は次が母音や y のときは「な行/にゃ行」になるので
             ROMA_TABLE の上位で吸収済み。それ以外は「ん」 */
          out += ROMA_TABLE[k][1];
          i += pat.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        /* 未知の英字は素通し（数字や記号など。normKey で多くは落ちている） */
        out += c;
        i++;
      }
    }
    /* normKey を通して長音記号などを統一 */
    return normKey(out);
  }

  /* レコード（店・アーティスト）の検索用キーをまとめて作る。
     - nk      : 名前の normKey
     - nkRoma  : 名前を romajiToKana 経由で normKey した結果（英名→カナ仮想）
     - aliasNk : aliases 配列（任意）を normKey した文字列の連結
     - aliasRoma: aliases を romajiToKana したものの連結（通常カナだが念のため） */
  function buildSearchKeys(name, aliases) {
    var nk = normKey(name);
    var nkRoma = romajiToKana(nk);
    var aliasNk = '';
    var aliasRoma = '';
    if (Array.isArray(aliases)) {
      for (var i = 0; i < aliases.length; i++) {
        var a = aliases[i];
        if (!a) continue;
        var an = normKey(a);
        aliasNk += '' + an;
        aliasRoma += '' + romajiToKana(an);
      }
    }
    return { nk: nk, nkRoma: nkRoma, aliasNk: aliasNk, aliasRoma: aliasRoma };
  }

  /* 検索クエリ nq とレコードのキー群でマッチ判定。
     - クエリと名前の正規化キー双方を「そのまま」「ローマ字→カナ変換後」両方で
       includes 比較し、いずれかが一致したらヒット。
     - 単方向ではなく双方向にすることで、英名→カナ・カナ→英名のどちらの
       入力でも掛かる（カナ→英名はカナのまま英字にはならないが、
       レコード名のローマ字→カナ展開で吸収できる）。 */
  function matchKey(nq, keys) {
    if (!nq) return true;
    if (!keys) return false;
    var nqRoma = romajiToKana(nq);
    if (keys.nk && keys.nk.indexOf(nq) !== -1) return true;
    if (keys.nkRoma && keys.nkRoma.indexOf(nq) !== -1) return true;
    if (nqRoma && keys.nk && keys.nk.indexOf(nqRoma) !== -1) return true;
    if (nqRoma && keys.nkRoma && keys.nkRoma.indexOf(nqRoma) !== -1) return true;
    if (keys.aliasNk && keys.aliasNk.indexOf(nq) !== -1) return true;
    if (keys.aliasRoma && keys.aliasRoma.indexOf(nq) !== -1) return true;
    if (nqRoma && keys.aliasNk && keys.aliasNk.indexOf(nqRoma) !== -1) return true;
    if (nqRoma && keys.aliasRoma && keys.aliasRoma.indexOf(nqRoma) !== -1) return true;
    return false;
  }
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }
  /* 最近チェックした出店・アーティストを記録（検索を空にした時に提示） */
  function pushRecent(type, id) {
    const a = state.recent[type];
    if (!a) return;
    const i = a.indexOf(id);
    if (i !== -1) a.splice(i, 1);
    a.unshift(id);
    if (a.length > 12) a.length = 12;
    save('mm2026_recent', state.recent);
  }

  /* ============================================================
     ヘッダー / ナイトモード
  ============================================================ */
  function renderHeader() {
    /* デイタブは「自分が行った日」を複数選択するUI。
       選択中は attended クラス（緑：var(--state-visited)）で示し、
       aria-pressed で複数選択の状態を補助技術にも伝える。 */
    $('#dayTabs').innerHTML = FESTIVAL.days.map(d => {
      const on = isAttended(d.id);
      return `<button class="day-tab ${on ? 'attended' : ''}" data-day="${d.id}" aria-pressed="${on ? 'true' : 'false'}" aria-label="${d.label} ${d.dow} を行った日として${on ? '解除' : '選択'}">
         <b class="en">${d.label}</b><span>${d.dow}</span></button>`;
    }).join('');
    $$('#dayTabs .day-tab').forEach(b => b.onclick = () => {
      toggleAttended(b.dataset.day);
      renderHeader();
      /* マイプラン画面（画像プレビューの元データ）を再描画。
         他ビューでは影響なし。 */
      if (state.view === 'myplan') renderMyplan();
    });
  }
  function tickClock() {
    const n = new Date();
    $('#clock').textContent =
      String(n.getHours()).padStart(2, '0') + ':' +
      String(n.getMinutes()).padStart(2, '0');
  }
  function applyNight() {
    document.body.classList.toggle('night', state.night);
    const b = $('#nightBtn'); if (b) b.textContent = state.night ? '☀️' : '🌙';
    /* ステータスバー色も表示モードに合わせる */
    const tc = document.querySelector('meta[name="theme-color"]');
    if (tc) tc.setAttribute('content', state.night ? '#15171c' : '#de1815');
  }

  /* ============================================================
     ビュー切替
  ============================================================ */
  function switchView(v) {
    state.view = v;
    $$('.view').forEach(x => x.classList.toggle('active', x.id === 'view-' + v));
    $$('.tabbar button').forEach(b =>
      b.classList.toggle('active', b.dataset.view === v));
    window.scrollTo(0, 0);
    rerender();
  }
  function rerender() {
    ({ artists: renderArtists, shops: renderShops, myplan: renderMyplan
     }[state.view] || function () {})();
    updateTabBadge();
  }
  function updateTabBadge() {
    /* 出店側は visited + nextYear のユニーク数で集計（行きたい廃止のため） */
    const shopIds = new Set([...state.visited, ...state.nextYear]);
    const n = state.fav.artists.length + shopIds.size;
    let b = $('#tabBadge');
    const btn = $('.tabbar button[data-view="myplan"]');
    if (!btn) return;
    if (!b) { b = el('span', 'badge'); b.id = 'tabBadge'; btn.appendChild(b); }
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  /* ============================================================
     出演日ヘルパー
  ============================================================ */
  function shortName(n) {
    return n.replace(/（.*?）/g, '').replace(/ STAGE| GATE/gi, '')
            .replace('MORI MICHI ', '').replace(' by Purveyors', '').trim();
  }
  /* 出演日ヘルパー。FESTIVAL.days を参照し、英字曜日を和名に変換する。 */
  const DOW_JA = { MON: '月', TUE: '火', WED: '水', THU: '木',
                   FRI: '金', SAT: '土', SUN: '日' };
  function dayChip(d) { return d.label + ' ' + (DOW_JA[d.dow] || d.dow); }
  /* アーティストの出演日を「5/22(金)・5/24(日)」形式の文字列にする。 */
  function artistDaysText(a) {
    const days = (a.days || [])
      .map(id => FESTIVAL.days.find(d => d.id === id))
      .filter(Boolean);
    if (!days.length) return '';
    return days.map(d => d.label + '(' + (DOW_JA[d.dow] || d.dow) + ')').join('・');
  }

  /* 出店の出店日チェックヘルパ */
  function shopOpenOn(s, dayId) {
    if (!s.days || !Array.isArray(s.days) || s.days.length === 0) return true;
    return s.days.indexOf(dayId) !== -1;
  }

  /* ============================================================
     アーティスト
  ============================================================ */
  function renderArtists() {
    const root = $('#view-artists');
    root.innerHTML = '';
    const sb = el('div', 'searchbar');
    sb.innerHTML = `<input type="search" inputmode="search" enterkeyhint="search"
      placeholder="アーティスト名で検索（かな・英字どちらでも）"
      aria-label="アーティスト名で検索" value="${esc(state.artistQuery)}">`;
    const artistSearch = debounce(renderArtistList, 160);
    sb.querySelector('input').oninput = e => {
      state.artistQuery = e.target.value; artistSearch();
    };
    root.appendChild(sb);
    /* 日程フィルタ。すべて＋公演3日（5/22・5/23・5/24）で出演者を絞り込む。 */
    const dayChips = el('div', 'chips');
    [['all', 'すべて']].concat(FESTIVAL.days.map(d => [d.id, dayChip(d)]))
      .forEach(c => {
        const ch = el('button',
          'chip' + (c[0] === state.artistDay ? ' active' : ''), c[1]);
        ch.onclick = () => { state.artistDay = c[0]; renderArtists(); };
        dayChips.appendChild(ch);
      });
    root.appendChild(dayChips);
    root.appendChild(el('div', 'notice',
      'ℹ️ 出演日・ステージ・時間は ' +
      '<a href="' + FESTIVAL.links.timetable + '" target="_blank" rel="noopener">' +
      '公式タイムテーブル</a> でご確認ください。'));
    const w = el('div'); w.id = 'artistListWrap';
    root.appendChild(w);
    renderArtistList();
  }
  function artistTile(a) {
    const dt = artistDaysText(a);
    const t = el('div', 'tile',
      `<div class="tile__cat">🎤</div>
       <div class="tile__name">${esc(a.name)}</div>
       <div class="tile__meta">${dt ? '🗓 ' + esc(dt) : '出演アーティスト'}</div>
       <button class="tile__fav" aria-label="お気に入り">${
         isFav('artists', a.id) ? '★' : '☆'}</button>`);
    t.onclick = () => openArtist(a.id);
    t.querySelector('.tile__fav').onclick = e => {
      e.stopPropagation();
      toast(toggleFav('artists', a.id) ? '★ マイプランに追加' : 'マイプランから削除');
      saveFav(); renderArtistList(); updateTabBadge();
    };
    return t;
  }
  function renderArtistList() {
    const w = $('#artistListWrap'); if (!w) return;
    const nq = normKey(state.artistQuery);
    const dayOk = a => state.artistDay === 'all' ||
      (a.days && a.days.indexOf(state.artistDay) !== -1);
    let list = ARTISTS.filter(a => (!nq || matchKey(nq, a)) && dayOk(a));
    w.innerHTML = '';
    if (!nq) {
      const rec = state.recent.artists
        .map(id => ARTISTS.find(a => a.id === id))
        .filter(a => a && dayOk(a));
      if (rec.length) {
        w.appendChild(el('div', 'list-count', '最近チェックしたアーティスト'));
        const rg = el('div', 'list-grid');
        rec.slice(0, 6).forEach(a => rg.appendChild(artistTile(a)));
        w.appendChild(rg);
        w.appendChild(el('div', 'list-count', '全出演者 ' + list.length + ' 組'));
      } else {
        w.appendChild(el('div', 'list-count', list.length + ' 組'));
      }
    } else {
      w.appendChild(el('div', 'list-count', list.length + ' 組'));
    }
    if (!list.length) {
      w.appendChild(el('div', 'empty',
        '<div class="big">🔍</div>「' + esc(state.artistQuery.trim()) +
        '」に一致する出演者はいません'));
      return;
    }
    const g = el('div', 'list-grid');
    list.forEach(a => g.appendChild(artistTile(a)));
    w.appendChild(g);
  }

  /* ============================================================
     出店ショップ
  ============================================================ */
  function renderShops() {
    const root = $('#view-shops');
    root.innerHTML = '';
    const sb = el('div', 'searchbar');
    sb.innerHTML = `<input type="search" inputmode="search" enterkeyhint="search"
      placeholder="出店名で検索（かな・英字どちらでも）"
      aria-label="出店名で検索" value="${esc(state.shopQuery)}">`;
    const shopSearch = debounce(renderShopList, 160);
    sb.querySelector('input').oninput = e => {
      state.shopQuery = e.target.value; shopSearch();
    };
    root.appendChild(sb);
    /* 出店日フィルタ。日替わり出店（種と旅と・モリミチ喫茶室・ウキウキ通り 18-20 ほか）
       を絞り込むため、検索・エリア絞り込みより手前に出す。 */
    const dayChips = el('div', 'chips');
    [['all', '全日']].concat(FESTIVAL.days.map(d =>
      [d.id, d.label + '(' + ({FRI:'金',SAT:'土',SUN:'日'}[d.dow] || d.dow) + ')']
    )).forEach(c => {
      const ch = el('button',
        'chip' + (c[0] === state.shopDay ? ' active' : ''), c[1]);
      ch.onclick = () => { state.shopDay = c[0]; renderShops(); };
      dayChips.appendChild(ch);
    });
    root.appendChild(dayChips);
    /* エリアフィルタ。すべて＋出店のある各エリアで絞り込む。
       マップのエリア括りと対応し、選択中はマップ表示への導線を出す。
       出店ゼロのエリア（のんのんパレード等）はチップに出さない。 */
    const chips = el('div', 'chips');
    [['all', 'すべて']].concat(
      ZONES.filter(z => z.type === 'area' &&
        SHOPS.some(s => s.zone === z.id)).map(z => [z.id, shortName(z.name)])
    ).forEach(c => {
      const ch = el('button',
        'chip' + (c[0] === state.shopZone ? ' active' : ''), c[1]);
      ch.onclick = () => { state.shopZone = c[0]; renderShops(); };
      chips.appendChild(ch);
    });
    root.appendChild(chips);
    root.appendChild(el('div', 'notice',
      'ℹ️ 公式では1000店舗以上が出店。全店舗は <a href="' + FESTIVAL.links.market +
      '" target="_blank" rel="noopener">公式サイト</a> へ。'));
    const w = el('div'); w.id = 'shopListWrap';
    root.appendChild(w);
    renderShopList();
  }
  function shopTile(s) {
    const v = isVisited(s.id);
    const m = hasNote(s.id);
    const ny = isNextYear(s.id);
    /* タイル下部に2状態トグルボタン（行った・来年）を並べ、
       一覧画面から直接ステータスを切り替えられるようにする。
       「行きたい」は会期終了後の振り返り用途では不要なため撤去。
       メモがある場合だけ、右上に小さな📝マークを表示（操作対象ではない）。 */
    const memoMark = m ? '<span class="tile__memo-mark" title="メモあり">📝</span>' : '';
    const t = el('div', 'tile tile--shop' + (v ? ' tile--visited' : ''),
      '<div class="tile__name">' + esc(s.name) + '</div>' +
      '<div class="tile__meta">📍 ' + esc(shortName(s.zoneName)) + '</div>' +
      memoMark +
      '<div class="tile__statebar tile__statebar--two">' +
        '<button class="state-btn state-btn--visited '  + (v  ? 'on' : '') + '" data-act="visit" aria-label="行った">' +
          '<span class="state-btn__ico">' + (v  ? '✓' : '○')    + '</span>' +
          '<span class="state-btn__lbl">行った</span></button>' +
        '<button class="state-btn state-btn--nextyear ' + (ny ? 'on' : '') + '" data-act="next"  aria-label="来年こそは">' +
          '<span class="state-btn__ico">' + (ny ? '🌱' : '🌿')   + '</span>' +
          '<span class="state-btn__lbl">来年</span></button>' +
      '</div>'
    );
    t.onclick = () => openShop(s.id);
    /* 2ボタンのクリック：伝播を止めて、それぞれの toggle を実行 */
    t.querySelectorAll('.state-btn').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const act = btn.getAttribute('data-act');
        if (act === 'visit') {
          const added = toggleVisited(s.id); saveVisited(); updateTabBadge();
          toast(added ? '✓ 行ったに追加' : '行ったから削除');
        } else {
          const added = toggleNextYear(s.id); saveNextYear(); updateTabBadge();
          toast(added ? '🌱 来年に追加' : '来年から削除');
        }
        renderShopList();
        if (state.view === 'myplan') renderMyplan();
      };
    });
    return t;
  }
  function renderShopList() {
    const w = $('#shopListWrap'); if (!w) return;
    const nq = normKey(state.shopQuery);
    const zoneOk = s => state.shopZone === 'all' || s.zone === state.shopZone;
    /* 出店日フィルタ。state.shopDay が 'all' なら無条件で通す。
       それ以外は shopOpenOn を使い、days 未指定（=全日）の店も通す。 */
    const dayOk = s => state.shopDay === 'all' || shopOpenOn(s, state.shopDay);
    let list = SHOPS.filter(s => zoneOk(s) && dayOk(s));
    if (nq) list = list.filter(s => matchKey(nq, s));
    w.innerHTML = '';
    /* 検索が空のときは「最近チェックした出店」を上部に提示 */
    if (!nq) {
      const rec = state.recent.shops
        .map(id => SHOPS.find(s => s.id === id))
        .filter(s => s && zoneOk(s) && dayOk(s));
      if (rec.length) {
        w.appendChild(el('div', 'list-count', '最近チェックした出店'));
        const rg = el('div', 'list-grid');
        rec.slice(0, 6).forEach(s => rg.appendChild(shopTile(s)));
        w.appendChild(rg);
        w.appendChild(el('div', 'list-count', 'すべての出店 ' + list.length + ' 店'));
      } else {
        w.appendChild(el('div', 'list-count', list.length + ' 店'));
      }
    } else {
      w.appendChild(el('div', 'list-count', list.length + ' 店'));
    }
    if (!list.length) {
      w.appendChild(el('div', 'empty',
        '<div class="big">🔍</div>「' + esc(state.shopQuery.trim()) +
        '」に一致する出店はありません'));
      return;
    }
    const g = el('div', 'list-grid');
    list.forEach(s => g.appendChild(shopTile(s)));
    w.appendChild(g);
  }

  /* ============================================================
     マイプラン
  ============================================================ */
  function renderMyplan() {
    const root = $('#view-myplan');
    root.innerHTML = '';
    const tabs = el('div', 'seg-tabs');
    /* 出店中心の振り返り体験を優先し、めぐった出店を左・観た出演者を右に。
       「めぐった」のカウントは visited + nextYear のユニーク数（行きたい廃止）。 */
    const shopPlanIds = new Set([...state.visited, ...state.nextYear]);
    [['shops', '🛍️ めぐった出店', shopPlanIds.size],
     ['artists', '⭐ 観た出演者', state.fav.artists.length]
    ].forEach(t => {
      const b = el('button', t[0] === state.myplanTab ? 'active' : '',
        t[1] + ' (' + t[2] + ')');
      b.onclick = () => { state.myplanTab = t[0]; renderMyplan(); };
      tabs.appendChild(b);
    });
    root.appendChild(tabs);

    if (state.myplanTab === 'artists') {
      const favs = ARTISTS.filter(a => isFav('artists', a.id));
      if (!favs.length) {
        root.appendChild(el('div', 'empty',
          '<div class="big">⭐</div>観た出演者を登録すると<br>ここに一覧表示されます'));
        appendMyplanSettings(root);
        return;
      }
      /* 出店側の wishlist サブタブと同じ位置に、画像シェアの導線を置く。 */
      const shareBtn = el('button', 'plan-map-btn', '観たアーティストをシェア');
      shareBtn.onclick = () => showArtistImagePreview();
      root.appendChild(shareBtn);

      root.appendChild(el('div', 'notice',
        'ℹ️ 出演時間は ' +
        '<a href="' + FESTIVAL.links.timetable + '" target="_blank" rel="noopener">' +
        '公式タイムテーブル</a> で確認できます。'));
      const g = el('div', 'list-grid');
      favs.forEach(a => {
        const dt = artistDaysText(a);
        const t = el('div', 'tile',
          `<div class="tile__cat">🎤</div>
           <div class="tile__name">${esc(a.name)}</div>
           <div class="tile__meta">${dt ? '🗓 ' + esc(dt) : '出演アーティスト'}</div>
           <button class="tile__fav">★</button>`);
        t.onclick = () => openArtist(a.id);
        t.querySelector('.tile__fav').onclick = e => {
          e.stopPropagation(); toggleFav('artists', a.id); saveFav();
          toast('マイプランから削除'); renderMyplan(); updateTabBadge();
        };
        g.appendChild(t);
      });
      root.appendChild(g);
      appendMyplanSettings(root);
    } else {
      /* 「めぐった出店」タブ：第2層チップで visited / nextyear を切替
         （wishlist は廃止。会期終了後の振り返りに「行きたい」は不要なため。
         状態が 'wishlist' のまま残っているユーザーは visited にフォールバック。） */
      if (state.myplanShopSubTab === 'wishlist') state.myplanShopSubTab = 'visited';

      /* 画像作成 CTA：トップタブ直下・サブタブ直上に配置することで、
         「めぐった出店タブを開いた瞬間に最も目立つアクション」として提示する。
         以前は最下段にあったが、スクロールしないと見えず CTA が埋もれていた。 */
      appendMyplanShareCta(root);

      const subCounts = {
        visited: state.visited.length,
        nextyear: state.nextYear.length
      };
      const subTabs = el('div', 'chips chips--sub');
      [['visited',  '✅ 行った'],
       ['nextyear', '🌱 来年']
      ].forEach(sb => {
        const c = el('button', 'chip' + (state.myplanShopSubTab === sb[0] ? ' active' : ''),
          sb[1] + ' (' + subCounts[sb[0]] + ')');
        c.setAttribute('data-sub', sb[0]);
        c.onclick = () => { state.myplanShopSubTab = sb[0]; renderMyplan(); };
        subTabs.appendChild(c);
      });
      root.appendChild(subTabs);

      const sub = state.myplanShopSubTab;
      let list = [];
      let emptyMsg = '';
      if (sub === 'visited') {
        list = SHOPS.filter(s => isVisited(s.id));
        emptyMsg = '<div class="big">✅</div>出店をタップして「行った」を選ぶと<br>ここに記録されます';
      } else {
        list = SHOPS.filter(s => isNextYear(s.id));
        emptyMsg = '<div class="big">🌱</div>「来年こそは」と思った出店を<br>出店から登録して残しておきましょう';
      }

      /* 2軸とも 0 件のオンボーディング。第2層チップの直下に使い方を案内 */
      const totalCount = subCounts.visited + subCounts.nextyear;
      if (totalCount === 0) {
        const ob = el('div', 'myplan-onboard');
        ob.innerHTML =
          '<div class="myplan-onboard__head">マイページの使い方</div>' +
          '<ol class="myplan-onboard__list">' +
            '<li><span class="myplan-onboard__n">1</span>' +
              '<div><b>出店ページから「行った」「来年」を選ぶ</b>' +
              '<p>めぐった店は「行った」、行きそびれた店は「来年」をタップ。</p></div></li>' +
            '<li><span class="myplan-onboard__n">2</span>' +
              '<div><b>店ごとにメモ・タグを残す</b>' +
              '<p>おすすめ・また来たい・写真映え… 来年の自分への申し送りを置けます。</p></div></li>' +
            '<li><span class="myplan-onboard__n">3</span>' +
              '<div><b>ここに溜まる／画像でシェア</b>' +
              '<p>「行った」「来年」が溜まると、1枚の画像で残せます。</p></div></li>' +
          '</ol>';
        const goShops = el('button', 'myplan-onboard__btn', '出店ページを開く');
        goShops.onclick = () => switchView('shops');
        ob.appendChild(goShops);
        root.appendChild(ob);
      }

      if (!list.length) {
        /* 2軸とも0件のときはオンボーディングを優先表示し、empty state は出さない */
        if (totalCount > 0) {
          root.appendChild(el('div', 'empty', emptyMsg));
        }
        appendMyplanSettings(root);
        return;
      }
      const g = el('div', 'list-grid');
      list.forEach(s => {
        /* shopTile を再利用して 2 状態ボタンの仕様を出店一覧と統一する */
        const t = shopTile(s);
        /* 行ったサブタブでは、タイル下にメモのプレビュー（タグ＋本文先頭）を併記 */
        if (sub === 'visited') {
          const n = getNote(s.id);
          if (n.tags.length || n.body) {
            const m = el('div', 'tile__notepreview');
            const tagLine = n.tags.length
              ? '<div class="tile__notetags">' + n.tags.slice(0, 3).map(x => '#' + esc(x)).join(' ') + '</div>'
              : '';
            const bodyLine = n.body
              ? '<div class="tile__notebody">' + esc(n.body.replace(/\n+/g, ' ').slice(0, 60)) + (n.body.length > 60 ? '…' : '') + '</div>'
              : '';
            m.innerHTML = tagLine + bodyLine;
            t.appendChild(m);
          }
        }
        g.appendChild(t);
      });
      root.appendChild(g);
      appendMyplanSettings(root);
    }
  }

  /* 画像作成 CTA の生成：めぐった出店タブの上部に挿入する用。
     renderMyplan から直接呼ばれる（appendMyplanSettings からは分離）。 */
  function appendMyplanShareCta(root) {
    const shareWrap = el('div', 'myplan-share-cta');
    shareWrap.innerHTML =
      '<div class="myplan-share-cta__head">📸 「わたしの森道」画像を作成</div>' +
      '<div class="myplan-share-cta__sub">めぐった出店と来年こそはの店を、1枚の雑誌風カードに。SNSへの共有や保存ができます。</div>';
    const shareBtn = el('button', 'myplan-share-cta__btn', '「わたしの森道」画像を作成');
    shareBtn.onclick = exportMyplanImage;
    shareWrap.appendChild(shareBtn);
    root.appendChild(shareWrap);
  }

  /* マイプラン最下段の「設定」セクション：エクスポート／インポートのみ。
     画像作成 CTA はトップタブ直下に分離（appendMyplanShareCta）。 */
  function appendMyplanSettings(root) {

    const wrap = el('div', 'myplan-settings');
    wrap.innerHTML = '<div class="myplan-settings__head">⚙️ データの保存</div>' +
      '<div class="myplan-settings__sub">記録は端末のブラウザに保存されています。機種変更・ブラウザデータ消去に備えてバックアップを取れます。</div>';
    const btnRow = el('div', 'myplan-settings__btns');
    const exportBtn = el('button', 'btn btn--ghost', '⬇️ JSONで書き出す');
    exportBtn.onclick = exportMyplan;
    const importBtn = el('button', 'btn btn--ghost', '⬆️ JSONを読み込む');
    importBtn.onclick = () => $('#myplanImportFile').click();
    btnRow.appendChild(exportBtn);
    btnRow.appendChild(importBtn);
    wrap.appendChild(btnRow);
    /* 隠しファイル入力 */
    const fileInput = el('input', '');
    fileInput.type = 'file';
    fileInput.accept = '.json,application/json';
    fileInput.id = 'myplanImportFile';
    fileInput.style.display = 'none';
    fileInput.onchange = (e) => importMyplan(e.target.files && e.target.files[0]);
    wrap.appendChild(fileInput);
    root.appendChild(wrap);
  }

  /* テキストシェア：マイプランの総数を読みやすい一文にまとめてシェア（絵文字なし）。
     visited / nextYear のどちらも 0 のときは「まだ記録がありません」と案内し、
     不自然なシェアを防ぐ。 */
  function shareMyplanText() {
    const v = state.visited.length;
    const n = state.nextYear.length;
    if (v === 0 && n === 0) {
      toast('「行った」または「来年こそは」を登録してからシェアできます');
      return;
    }
    const lines = [];
    if (v > 0) lines.push('今年の森道、めぐったのは ' + v + ' 店。');
    if (n > 0) lines.push('来年こそは ' + n + ' 店。');
    /* 行った日が選択されていれば併記する。 */
    const att = attendedDaysText();
    if (att) lines.push('行った日：' + att);
    lines.push('');
    lines.push('#森道市場2026 #森道市場');
    shareOrCopy({
      title: '2026 年の、わたしの森道。',
      text: lines.join('\n'),
      url: APP_URL
    });
  }

  /* シェア画像の色テーマ：15色。Magazine B 型構造を保ちつつ、号数違いとして
     色のみを差し替える。アースカラー10色（落ち着いた森道らしさ）に加え、
     vivid 5色（フレイム・シトラス・エメラルド・ロイヤル・フューシャ）を追加。
     彩度・明度の高い原色系は、写真映え重視で派手にシェアしたいユーザー向け。 */
  const SHARE_THEMES = {
    /* —— アースカラー10色 —— */
    moss:       { id:'moss',       label:'モス',       bg:'#1B3A2E', ivory:'#EFEAE0', accent:'#E8B547' }, /* 森 */
    herb:       { id:'herb',       label:'ハーブ',     bg:'#5C7A4F', ivory:'#F4F0DC', accent:'#C44A2E' }, /* 草・若葉 */
    sand:       { id:'sand',       label:'サンド',     bg:'#B8956A', ivory:'#FEFAEC', accent:'#3E5C48' }, /* 砂浜 */
    sakura:     { id:'sakura',     label:'サクラ',     bg:'#C77A6B', ivory:'#FFF1EC', accent:'#3A3A2E' }, /* 桜・春の色 */
    terracotta: { id:'terracotta', label:'テラコッタ', bg:'#6B3A2A', ivory:'#F2EBDC', accent:'#E8B547' }, /* 土 */
    charcoal:   { id:'charcoal',   label:'チャコール', bg:'#2A2622', ivory:'#F2EBDC', accent:'#B5341F' }, /* 墨・活版 */
    dusk:       { id:'dusk',       label:'ダスク',     bg:'#4A3E5A', ivory:'#F0E8DC', accent:'#E8B547' }, /* 夕暮れ・薄暮 */
    indigo:     { id:'indigo',     label:'インディゴ', bg:'#1F3540', ivory:'#EDE5D0', accent:'#C44A2E' }, /* 海・暖簾 */
    ocean:      { id:'ocean',      label:'オーシャン', bg:'#2E5A6B', ivory:'#E8E8DC', accent:'#E8B547' }, /* 深海・蒲郡の海 */
    mist:       { id:'mist',       label:'ミスト',     bg:'#5E7A88', ivory:'#F3EFE4', accent:'#4A5D3A' }, /* 霧・地図 */
    /* —— ヴィヴィッド5色（高彩度・高明度） —— */
    flame:      { id:'flame',      label:'フレイム',   bg:'#E63946', ivory:'#FFF8F0', accent:'#FFD60A' }, /* 炎・夏祭り提灯 */
    citrus:     { id:'citrus',     label:'シトラス',   bg:'#FFB700', ivory:'#1A1A1A', accent:'#D62828' }, /* 柑橘・夏空の太陽 */
    emerald:    { id:'emerald',    label:'エメラルド', bg:'#06A77D', ivory:'#FFFAE7', accent:'#FFB703' }, /* 鮮緑・芝・葉 */
    royal:      { id:'royal',      label:'ロイヤル',   bg:'#1E6FD9', ivory:'#FFFAE5', accent:'#FFB703' }, /* 鮮青・夏空 */
    fuchsia:    { id:'fuchsia',    label:'フューシャ', bg:'#E63A77', ivory:'#FFF0F5', accent:'#FCE13D' }  /* 桃赤・南国の花 */
  };
  const SHARE_THEME_ORDER = [
    'moss','herb','sand','sakura','terracotta','charcoal','dusk','indigo','ocean','mist',
    'flame','citrus','emerald','royal','fuchsia'
  ];
  function getCurrentShareTheme() {
    try {
      const id = localStorage.getItem('mm2026_share_theme');
      if (id && SHARE_THEMES[id]) return SHARE_THEMES[id];
    } catch (e) {}
    return SHARE_THEMES.moss;
  }

  /* マイプランカード画像を 1080x1920（9:16）で描画して canvas を返す。
     コンセプト：Magazine B 型「雑誌の表紙」。アースカラー3色で構成。
     系統：Casa BRUTUS / POPEYE 建築×ランドスケープ号の配色。
     themeId を渡すと色テーマを切替。省略時は現在保存されたテーマを使う。 */
  function generateMyplanCanvas(themeId) {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    /* カラーパレット（3色厳守）：bg ＋ ivory ＋ accent */
    const theme = (themeId && SHARE_THEMES[themeId]) || getCurrentShareTheme();
    const COLOR = {
      bg:      theme.bg,
      ivory:   theme.ivory,
      mustard: theme.accent  /* 既存コード互換のため変数名は維持 */
    };
    /* フォント（system フォント前提）。明朝系の表記精度を優先 */
    const FONT = {
      mincho: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif',
      sans:   '"Helvetica Neue", -apple-system, "Hiragino Sans", sans-serif',
      mono:   '"SF Mono", "Menlo", "Courier New", monospace'
    };

    /* 数値とリスト */
    const visited  = state.visited.length;
    const nextYr   = state.nextYear.length;
    const visitedShops = SHOPS.filter(s => isVisited(s.id));
    const nextYearShops = SHOPS.filter(s => isNextYear(s.id));

    /* 1. 地色 */
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    /* 2. 最上部の極小ヴォリューム表記（号数） */
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.ivory;
    /* letterSpacing は Canvas にないため、1文字ずつ x を進めて擬似実装 */
    function drawSpaced(text, x, y, fontSpec, color, gap) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = fontSpec;
      let cx = x;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], cx, y);
        cx += ctx.measureText(text[i]).width + gap;
      }
      ctx.restore();
    }
    drawSpaced('VOL.2026  /  MORIMICHI', 80, 150,
      '500 18px ' + FONT.sans, COLOR.ivory, 4);

    /* 3. 表紙タイトル「わたしの森道。」を中央配置（雑誌の表紙コピー） */
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '700 142px ' + FONT.mincho;
    ctx.fillText('わたしの森道。', W/2, 320);

    /* 4. 細い水平線（マスタード、幅50%、中央） */
    ctx.strokeStyle = COLOR.mustard;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W/2 - 240, 390);
    ctx.lineTo(W/2 + 240, 390);
    ctx.stroke();

    /* 5. 特集タイトル（明朝、雑誌の特集コピー風） */
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '500 62px ' + FONT.mincho;
    let featureLine;
    if (visited > 0 && nextYr > 0) {
      featureLine = 'めぐった ' + visited + ' 店、来年の ' + nextYr + ' 店。';
    } else if (visited > 0) {
      featureLine = 'めぐった、' + visited + ' 店。';
    } else {
      featureLine = '来年こそは、' + nextYr + ' 店。';
    }
    ctx.fillText(featureLine, W/2, 510);

    /* 6. 目次見出し（左寄せ、マスタード、等幅小） */
    ctx.textAlign = 'left';
    function drawSectionHead(label, count, y) {
      drawSpaced(label, 80, y, '500 18px ' + FONT.mono, COLOR.mustard, 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = COLOR.mustard;
      ctx.font = '500 18px ' + FONT.mono;
      ctx.fillText('— ' + count, W - 80, y);
      ctx.textAlign = 'left';
    }
    function drawHairUnder(y) {
      ctx.strokeStyle = COLOR.mustard;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(W - 80, y);
      ctx.stroke();
    }

    /* 店舗リスト描画：2列。Aデザイナーの提案にあった「余白で語る紙面」を
       回復するため、行高 50px / 店名 30px / 番号 24px に少しだけ大きく。
       1セクション 10段×2列＝最大20件。30件詰め込みで余白が消えていた
       前回からの揺り戻し。 */
    function trimByWidth(text, maxWidth) {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let s = text;
      while (s.length > 0) {
        s = s.slice(0, -1);
        if (ctx.measureText(s + '…').width <= maxWidth) return s + '…';
      }
      return '…';
    }
    function drawShopList2Col(items, startY, maxPerCol, lineH) {
      ctx.textAlign = 'left';
      const cap = maxPerCol * 2;
      const willOverflow = items.length > cap;
      const showCount = willOverflow ? cap - 1 : Math.min(items.length, cap);
      const colX  = [80, 580];
      const nameX = [134, 634];     /* 番号→名前のギャップ、フォント拡大に合わせて広めに */
      const COL_END = [560, 1060];
      const maxNameW = [COL_END[0] - nameX[0] - 6, COL_END[1] - nameX[1] - 6];
      for (let i = 0; i < showCount; i++) {
        const col = Math.floor(i / maxPerCol);
        const row = i % maxPerCol;
        const y = startY + row * lineH;
        const n = String(i + 1).padStart(2, '0');
        ctx.fillStyle = COLOR.mustard;
        ctx.font = '500 24px ' + FONT.mono;
        ctx.fillText(n, colX[col], y);
        ctx.fillStyle = COLOR.ivory;
        ctx.font = '500 30px ' + FONT.mincho;
        const name = trimByWidth(items[i].name, maxNameW[col]);
        ctx.fillText(name, nameX[col], y);
      }
      if (willOverflow) {
        const rest = items.length - showCount;
        const col = Math.floor(showCount / maxPerCol);
        const row = showCount % maxPerCol;
        ctx.fillStyle = COLOR.ivory;
        ctx.font = '300 24px ' + FONT.mincho;
        ctx.fillText('& ' + rest + ' more', nameX[col], startY + row * lineH);
      }
      if (items.length === 0) {
        ctx.fillStyle = COLOR.ivory;
        ctx.globalAlpha = 0.5;
        ctx.font = '300 24px ' + FONT.mincho;
        ctx.fillText('—  まだ記録がありません', 80, startY);
        ctx.globalAlpha = 1;
      }
    }

    /* 7. VISITED 2026（めぐった）— 2列 10段で最大20件
       行高 50・店名30 で余白あるレイアウトに戻す */
    const VISITED_HEAD_Y = 640;
    drawSectionHead('VISITED  2026', visited, VISITED_HEAD_Y);
    drawHairUnder(VISITED_HEAD_Y + 18);
    drawShopList2Col(visitedShops, VISITED_HEAD_Y + 70, 10, 50);
    /* リスト終了 y: 640+70+9*50 = 1160 */

    /* 8. WISHLIST 2027（来年こそは）— 2列 10段で最大20件 */
    const WISHLIST_HEAD_Y = 1240;
    drawSectionHead('WISHLIST  2027', nextYr, WISHLIST_HEAD_Y);
    drawHairUnder(WISHLIST_HEAD_Y + 18);
    drawShopList2Col(nextYearShops, WISHLIST_HEAD_Y + 70, 10, 50);
    /* リスト終了 y: 1240+70+9*50 = 1760 */

    /* 9. 最下部の発行情報（左寄せ）と #ハッシュタグ（右下）
       行った日（attendedDays）が1件以上選択されているときのみ、
       選択された日付（例「5.22・5.24」）を 1810 に挿入する。
       プレフィックスは付けず、日付のみで簡潔に。 */
    const attended = attendedDaysShort();
    if (attended) {
      ctx.textAlign = 'left';
      ctx.fillStyle = COLOR.mustard;
      ctx.font = '500 18px ' + FONT.mincho;
      ctx.fillText(attended, 80, 1810);
    }
    drawSpaced('MORIMICHI ICHIBA  2026', 80, 1840,
      '500 18px ' + FONT.sans, COLOR.mustard, 3);
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '500 20px ' + FONT.mincho;
    ctx.fillText('ラグーナビーチ・蒲郡', 80, 1875);
    /* ハッシュタグ（右下、accent 色で控えめサイズ） */
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR.mustard;
    ctx.font = '500 22px ' + FONT.mincho;
    ctx.fillText('#わたしの森道', W - 80, 1875);

    return canvas;
  }

  /* プレビューモーダル：書き出し前に画像を確認、5色テーマから選んでシェア／保存。
     iOS では img の長押しでカメラロール保存も可能。
     データが空の場合は案内のみ。 */
  function showMyplanImagePreview() {
    if (state.visited.length === 0 && state.nextYear.length === 0) {
      toast('「行った」または「来年こそは」を登録してからシェアできます');
      return;
    }
    /* 現在の canvas を変数として保持（テーマ切替時に置き換える） */
    let currentTheme = getCurrentShareTheme();
    let currentCanvas = generateMyplanCanvas(currentTheme.id);
    const dataUrl0 = currentCanvas.toDataURL('image/png');

    /* テーマ選択チップを構築（各チップに背景色のスウォッチを表示） */
    const swatchHtml = SHARE_THEME_ORDER.map(id => {
      const th = SHARE_THEMES[id];
      const active = id === currentTheme.id ? ' is-active' : '';
      return '<button class="theme-chip' + active + '" data-theme="' + id +
        '" aria-label="' + esc(th.label) + '">' +
        '<span class="theme-chip__sw" style="background:' + th.bg +
          ';color:' + th.ivory + ';border-color:' + th.ivory + '">' +
          '<span class="theme-chip__dot" style="background:' + th.accent + '"></span>' +
        '</span>' +
        '<span class="theme-chip__lbl">' + esc(th.label) + '</span>' +
      '</button>';
    }).join('');

    openModal(
      '<div class="modal__handle"></div>' +
      '<p class="image-preview__title">プレビュー</p>' +
      '<div class="image-preview">' +
        '<img src="' + dataUrl0 + '" alt="マイプラン プレビュー" class="image-preview__img" id="ipImg">' +
      '</div>' +
      '<p class="image-preview__themehead">色を選ぶ</p>' +
      '<div class="theme-chips" id="ipThemes">' + swatchHtml + '</div>' +
      '<p class="image-preview__hint">画像を長押し（スマホ）でカメラロールに保存できます。下のボタンからもシェア／保存できます。</p>' +
      '<div class="modal__btns">' +
        '<button class="btn btn--primary" id="ipShare">シェア／保存する</button>' +
      '</div>'
    );

    const visited = state.visited.length;
    const nextYr  = state.nextYear.length;

    /* テーマチップのクリックで canvas を再生成、img を差し替え、保存テーマを更新 */
    $$('#ipThemes .theme-chip').forEach(chip => {
      chip.onclick = () => {
        const id = chip.getAttribute('data-theme');
        if (!SHARE_THEMES[id]) return;
        currentTheme = SHARE_THEMES[id];
        currentCanvas = generateMyplanCanvas(id);
        const img = $('#ipImg');
        if (img) img.src = currentCanvas.toDataURL('image/png');
        $$('#ipThemes .theme-chip').forEach(c => c.classList.toggle('is-active', c === chip));
        try { localStorage.setItem('mm2026_share_theme', id); } catch (e) {}
      };
    });

    $('#ipShare').onclick = () => {
      currentCanvas.toBlob((blob) => {
        if (!blob) { toast('画像の生成に失敗しました'); return; }
        const file = new File([blob], 'watashi-no-morimichi-2026.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: '2026 年の、わたしの森道。',
            text: '今年の森道、めぐったのは ' + visited + ' 店。来年こそは ' + nextYr + ' 店。\n#森道市場2026 #森道市場'
          }).catch(() => {});
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'watashi-no-morimichi-2026.png';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('画像をダウンロードしました');
      }, 'image/png');
    };
  }

  /* マイページ「画像で書き出す」ボタンから呼ぶエントリポイント */
  function exportMyplanImage() {
    showMyplanImagePreview();
  }

  /* 観たアーティスト一覧の画像（1080x1920）を生成する。
     generateMyplanCanvas と同じ Magazine B / Casa BRUTUS 系のトーンを共有。
     出店側と違い「来年」の概念がないため、LINEUP 1セクション構成。 */
  function generateArtistCanvas(themeId) {
    const W = 1080, H = 1920;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    /* カラーパレット（3色厳守）：bg ＋ ivory ＋ accent。
       SHARE_THEMES / SHARE_THEME_ORDER は myplan 側と共有する。 */
    const theme = (themeId && SHARE_THEMES[themeId]) || getCurrentShareTheme();
    const COLOR = {
      bg:      theme.bg,
      ivory:   theme.ivory,
      mustard: theme.accent
    };
    const FONT = {
      mincho: '"Hiragino Mincho ProN", "Yu Mincho", "YuMincho", serif',
      sans:   '"Helvetica Neue", -apple-system, "Hiragino Sans", sans-serif',
      mono:   '"SF Mono", "Menlo", "Courier New", monospace'
    };

    /* 観たアーティスト一覧。state.fav.artists の id 順ではなく
       ARTISTS の元順を尊重して安定した並びを保つ。 */
    const favArtists = ARTISTS.filter(a => isFav('artists', a.id));
    const n = favArtists.length;

    /* 1. 地色 */
    ctx.fillStyle = COLOR.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';

    /* 2. 最上部の極小ヴォリューム表記（号数 + アーティスト号であることの明示） */
    ctx.textAlign = 'left';
    ctx.fillStyle = COLOR.ivory;
    function drawSpaced(text, x, y, fontSpec, color, gap) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = fontSpec;
      let cx = x;
      for (let i = 0; i < text.length; i++) {
        ctx.fillText(text[i], cx, y);
        cx += ctx.measureText(text[i]).width + gap;
      }
      ctx.restore();
    }
    drawSpaced('VOL.2026  /  MORIMICHI ARTISTS', 80, 150,
      '500 18px ' + FONT.sans, COLOR.ivory, 4);

    /* 3. 表紙タイトル「わたしの森道。」
       myplan版（出店用）と同じ位置に揃え、雑誌の表紙コピーとして配置する。 */
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '700 142px ' + FONT.mincho;
    ctx.fillText('わたしの森道。', W/2, 320);

    /* 4. 細い水平線（マスタード、幅50%、中央） */
    ctx.strokeStyle = COLOR.mustard;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W/2 - 240, 390);
    ctx.lineTo(W/2 + 240, 390);
    ctx.stroke();

    /* 5. 特集タイトル（明朝、雑誌の特集コピー風） */
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '500 62px ' + FONT.mincho;
    ctx.fillText('森道で聴いた ' + n + ' 組。', W/2, 510);

    /* 6. 目次見出し（左寄せ、マスタード、等幅小） */
    ctx.textAlign = 'left';
    function drawSectionHead(label, count, y) {
      drawSpaced(label, 80, y, '500 18px ' + FONT.mono, COLOR.mustard, 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = COLOR.mustard;
      ctx.font = '500 18px ' + FONT.mono;
      ctx.fillText('— ' + count, W - 80, y);
      ctx.textAlign = 'left';
    }
    function drawHairUnder(y) {
      ctx.strokeStyle = COLOR.mustard;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(80, y);
      ctx.lineTo(W - 80, y);
      ctx.stroke();
    }

    function trimByWidth(text, maxWidth) {
      if (ctx.measureText(text).width <= maxWidth) return text;
      let s = text;
      while (s.length > 0) {
        s = s.slice(0, -1);
        if (ctx.measureText(s + '…').width <= maxWidth) return s + '…';
      }
      return '…';
    }
    /* アーティスト名 2列リスト。myplan 側 drawShopList2Col と同等の
       行高 50px / 名前 30px / 番号 24px。1セクション最大 20件。 */
    function drawArtistList2Col(items, startY, maxPerCol, lineH) {
      ctx.textAlign = 'left';
      const cap = maxPerCol * 2;
      const willOverflow = items.length > cap;
      const showCount = willOverflow ? cap - 1 : Math.min(items.length, cap);
      const colX  = [80, 580];
      const nameX = [134, 634];
      const COL_END = [560, 1060];
      const maxNameW = [COL_END[0] - nameX[0] - 6, COL_END[1] - nameX[1] - 6];
      for (let i = 0; i < showCount; i++) {
        const col = Math.floor(i / maxPerCol);
        const row = i % maxPerCol;
        const y = startY + row * lineH;
        const num = String(i + 1).padStart(2, '0');
        ctx.fillStyle = COLOR.mustard;
        ctx.font = '500 24px ' + FONT.mono;
        ctx.fillText(num, colX[col], y);
        ctx.fillStyle = COLOR.ivory;
        ctx.font = '500 30px ' + FONT.mincho;
        const name = trimByWidth(items[i].name, maxNameW[col]);
        ctx.fillText(name, nameX[col], y);
      }
      if (willOverflow) {
        const rest = items.length - showCount;
        const col = Math.floor(showCount / maxPerCol);
        const row = showCount % maxPerCol;
        ctx.fillStyle = COLOR.ivory;
        ctx.font = '300 24px ' + FONT.mincho;
        ctx.fillText('& ' + rest + ' more', nameX[col], startY + row * lineH);
      }
      if (items.length === 0) {
        ctx.fillStyle = COLOR.ivory;
        ctx.globalAlpha = 0.5;
        ctx.font = '300 24px ' + FONT.mincho;
        ctx.fillText('—  まだ記録がありません', 80, startY);
        ctx.globalAlpha = 1;
      }
    }

    /* 7. LINEUP 2026（観た）— 2列 10段で最大20件
       myplan版の VISITED と同じ高さに揃え、文字組の体感を共有する。 */
    const LINEUP_HEAD_Y = 640;
    drawSectionHead('LINEUP  2026', n, LINEUP_HEAD_Y);
    drawHairUnder(LINEUP_HEAD_Y + 18);
    drawArtistList2Col(favArtists, LINEUP_HEAD_Y + 70, 10, 50);

    /* 8. 最下部の発行情報（左寄せ）と #ハッシュタグ（右下）
       myplan 側と同じ流儀で「行った日」を1行で挿入する。 */
    const attended = attendedDaysShort();
    if (attended) {
      ctx.textAlign = 'left';
      ctx.fillStyle = COLOR.mustard;
      ctx.font = '500 18px ' + FONT.mincho;
      ctx.fillText(attended, 80, 1810);
    }
    drawSpaced('MORIMICHI ICHIBA  2026', 80, 1840,
      '500 18px ' + FONT.sans, COLOR.mustard, 3);
    ctx.fillStyle = COLOR.ivory;
    ctx.font = '500 20px ' + FONT.mincho;
    ctx.fillText('ラグーナビーチ・蒲郡', 80, 1875);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR.mustard;
    ctx.font = '500 22px ' + FONT.mincho;
    ctx.fillText('#わたしの森道', W - 80, 1875);

    return canvas;
  }

  /* 観たアーティスト画像のプレビューモーダル。
     showMyplanImagePreview と同じ構造で、テーマ切替・シェア／保存に対応。 */
  function showArtistImagePreview() {
    if (state.fav.artists.length === 0) {
      toast('観たアーティストを登録してから画像を書き出せます');
      return;
    }
    let currentTheme = getCurrentShareTheme();
    let currentCanvas = generateArtistCanvas(currentTheme.id);
    const dataUrl0 = currentCanvas.toDataURL('image/png');

    const swatchHtml = SHARE_THEME_ORDER.map(id => {
      const th = SHARE_THEMES[id];
      const active = id === currentTheme.id ? ' is-active' : '';
      return '<button class="theme-chip' + active + '" data-theme="' + id +
        '" aria-label="' + esc(th.label) + '">' +
        '<span class="theme-chip__sw" style="background:' + th.bg +
          ';color:' + th.ivory + ';border-color:' + th.ivory + '">' +
          '<span class="theme-chip__dot" style="background:' + th.accent + '"></span>' +
        '</span>' +
        '<span class="theme-chip__lbl">' + esc(th.label) + '</span>' +
      '</button>';
    }).join('');

    openModal(
      '<div class="modal__handle"></div>' +
      '<p class="image-preview__title">プレビュー</p>' +
      '<div class="image-preview">' +
        '<img src="' + dataUrl0 + '" alt="観たアーティスト プレビュー" class="image-preview__img" id="ipImg">' +
      '</div>' +
      '<p class="image-preview__themehead">色を選ぶ</p>' +
      '<div class="theme-chips" id="ipThemes">' + swatchHtml + '</div>' +
      '<p class="image-preview__hint">画像を長押し（スマホ）でカメラロールに保存できます。下のボタンからもシェア／保存できます。</p>' +
      '<div class="modal__btns">' +
        '<button class="btn btn--primary" id="ipShare">シェア／保存する</button>' +
      '</div>'
    );

    const n = state.fav.artists.length;

    $$('#ipThemes .theme-chip').forEach(chip => {
      chip.onclick = () => {
        const id = chip.getAttribute('data-theme');
        if (!SHARE_THEMES[id]) return;
        currentTheme = SHARE_THEMES[id];
        currentCanvas = generateArtistCanvas(id);
        const img = $('#ipImg');
        if (img) img.src = currentCanvas.toDataURL('image/png');
        $$('#ipThemes .theme-chip').forEach(c => c.classList.toggle('is-active', c === chip));
        try { localStorage.setItem('mm2026_share_theme', id); } catch (e) {}
      };
    });

    $('#ipShare').onclick = () => {
      currentCanvas.toBlob((blob) => {
        if (!blob) { toast('画像の生成に失敗しました'); return; }
        const file = new File([blob], 'morimichi2026-artists.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            files: [file],
            title: '2026 年、観たアーティスト。',
            text: '観たのは ' + n + ' 組。\n#森道市場2026 #森道市場'
          }).catch(() => {});
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'morimichi2026-artists.png';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        toast('画像をダウンロードしました');
      }, 'image/png');
    };
  }

  /* 観たアーティスト画像書き出しのエントリポイント */
  function exportArtistImage() {
    showArtistImagePreview();
  }

  /* 角丸矩形ヘルパ（Canvas） */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* 全マイプランデータを1ファイルにまとめてダウンロード */
  function exportMyplan() {
    const payload = {
      version: 1,
      app: 'watashi-no-morimichi',
      exportedAt: new Date().toISOString(),
      data: {
        fav: state.fav,
        visited: state.visited,
        nextYear: state.nextYear,
        notes: state.notes,
        checks: state.checks
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'watashi-no-morimichi-myplan-' + yyyymmdd + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    toast('マイプランを書き出しました');
  }

  /* JSONファイルを読み込み、現在のデータを上書き
     サニタイズは要素レベルまで（破損データ部分はスキップして残りを採用）。 */
  function importMyplan(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (!obj || obj.app !== 'watashi-no-morimichi' || obj.version !== 1 || !obj.data) {
          alert('このファイルはマイプランの書き出しファイルではないようです。');
          return;
        }
        if (!confirm('現在の記録を、ファイルの内容で上書きします。よろしいですか？\n（書き出し日時：' +
                     (obj.exportedAt || '不明') + '）')) return;
        const d = obj.data;
        let skipped = 0;
        /* 文字列配列ヘルパ：要素単位で型チェック、不正はスキップ */
        const strArr = (a) => {
          if (!Array.isArray(a)) { skipped++; return null; }
          const out = []; for (const x of a) { if (typeof x === 'string') out.push(x); else skipped++; }
          return out;
        };
        /* fav は {artists:[], shops:[]} 形式を強要 */
        if (d.fav && typeof d.fav === 'object' && !Array.isArray(d.fav)) {
          const fa = strArr(d.fav.artists), fs = strArr(d.fav.shops);
          if (fa && fs) state.fav = { artists: fa, shops: fs };
          else skipped++;
        }
        /* visited / nextYear は文字列配列 */
        const vis = strArr(d.visited); if (vis) state.visited = vis;
        const ny  = strArr(d.nextYear); if (ny)  state.nextYear = ny;
        /* notes は {[id]: NoteObj}。要素単位で型検証してから移植。
           setNote を経由すると updatedAt が現在時刻で上書きされてしまうため、
           インポート時はファイル側の updatedAt を尊重する。 */
        if (d.notes && typeof d.notes === 'object' && !Array.isArray(d.notes)) {
          state.notes = {};
          for (const id of Object.keys(d.notes)) {
            const n = d.notes[id];
            if (!n || typeof n !== 'object' || Array.isArray(n)) { skipped++; continue; }
            const tags = Array.isArray(n.tags) ? [...new Set(n.tags.filter(t => typeof t === 'string'))] : [];
            let body = typeof n.body === 'string' ? n.body : '';
            const arr = [...body];
            if (arr.length > 500) body = arr.slice(0, 500).join('');
            const updatedAt = typeof n.updatedAt === 'number' ? n.updatedAt : 0;
            if (tags.length === 0 && body.length === 0) continue;
            state.notes[id] = { tags, body, updatedAt };
          }
        }
        /* checks はオブジェクト */
        if (d.checks && typeof d.checks === 'object' && !Array.isArray(d.checks)) {
          state.checks = d.checks;
        }
        sanitizeState();
        saveFav(); saveVisited(); saveNextYear(); saveNotes();
        save('mm2026_checks', state.checks);
        toast(skipped > 0
          ? 'マイプランを読み込みました（' + skipped + '件の不正データはスキップ）'
          : 'マイプランを読み込みました');
        renderMyplan(); updateTabBadge();
        if (state.view === 'shops') renderShopList();
      } catch (err) {
        alert('ファイルを読み込めませんでした：' + (err && err.message ? err.message : err));
      }
    };
    reader.readAsText(file);
  }

  /* ============================================================
     モーダル
  ============================================================ */
  let modalOpen = false, modalLastFocus = null;
  function openModal(html) {
    const body = $('#modalBody'), bg = $('#modalBg');
    /* 全モーダル共通で、右上に明示的な「✕」閉じるボタンを差し込む。
       モーダル外タップ／Escape／スワイプバックでも閉じられるが、上部に
       タップ可能な明示ボタンを置くことで「戻りにくさ」を解消する。 */
    body.innerHTML =
      '<button class="modal__close" id="modalCloseBtn" type="button" aria-label="閉じる">✕</button>' + html;
    const closeBtn = body.querySelector('#modalCloseBtn');
    if (closeBtn) closeBtn.onclick = () => closeModal();
    modalLastFocus = document.activeElement;
    bg.classList.add('open');
    /* Android のハードウェア戻る / iOS スワイプバックで閉じられるよう履歴に積む */
    if (!modalOpen) {
      modalOpen = true;
      try { history.pushState({ modal: 1 }, ''); } catch (e) {}
    }
    /* フォーカスをモーダル内へ移す（キーボード／スクリーンリーダー対応）。
       閉じるボタンには初期フォーカスを当てない（誤タップ防止のため
       一番上のコンテンツ要素を優先）。 */
    const first = body.querySelector('button:not(#modalCloseBtn), a, input');
    if (first) setTimeout(() => { try { first.focus(); } catch (e) {} }, 30);
  }
  /* fromPop=true は popstate 由来（履歴は既に戻っている）。
     ユーザー操作（×ボタン等）由来は履歴を1つ戻して整合させる。 */
  function closeModal(fromPop) {
    const bg = $('#modalBg');
    if (!bg.classList.contains('open')) return;
    /* メモ入力中に閉じられた場合のみ未確定分を保存。
       タイマーが無い場合（メモを開いていないモーダル）は何もしない＝
       関係ないモーダルの開閉で localStorage 書き込みを発生させない。 */
    if (_noteSaveTimer) {
      clearTimeout(_noteSaveTimer);
      _noteSaveTimer = null;
      saveNotes();
    }
    bg.classList.remove('open');
    if (modalOpen && !fromPop) {
      modalOpen = false;
      try { history.back(); } catch (e) {}
    } else {
      modalOpen = false;
    }
    if (modalLastFocus && modalLastFocus.focus) {
      try { modalLastFocus.focus(); } catch (e) {}
    }
    modalLastFocus = null;
  }

  /* ============================================================
     初回ポップアップ：「わたしの森道」の使い方
     初めて開く人に1回だけ表示する。 */
  function showThanksPopupIfFirst() {
    let seen = '';
    try { seen = localStorage.getItem('mm2026_intro_seen_v1') || ''; } catch (e) {}
    if (seen === '1') return;

    const html =
      '<div class="thanks-popup">' +
        '<h2 class="thanks-popup__title">わたしの森道の使い方</h2>' +
        '<div class="thanks-popup__body">' +
          '<p>森道2026を「あとから振り返って残す」ための4つの機能を、マイページに追加しました。</p>' +
          '<ul class="thanks-popup__list">' +
            '<li><b>めぐった出店を記録</b>　出店をタップして「行った」を選ぶと、タイルに印が付きます。</li>' +
            '<li><b>来年こそはリスト</b>　気になっていたのに行けなかった店を、来年に持ち越し。</li>' +
            '<li><b>店ごとのメモ</b>　おすすめ・また来たい・写真映え… タグ＋自由メモを500字まで。</li>' +
            '<li><b>マイプランをシェア</b>　「わたしの森道」を1枚の画像にして、SNSに残せます。</li>' +
          '</ul>' +
          '<p>会期中の慌ただしさが落ち着いたら、ぜひ振り返ってみてください。</p>' +
        '</div>' +
        '<div class="thanks-popup__actions">' +
          '<button class="thanks-popup__btn thanks-popup__btn--primary" ' +
            'id="introOpenBtn" type="button">マイページを開く</button>' +
          '<button class="thanks-popup__btn thanks-popup__btn--close" ' +
            'id="thanksCloseBtn" type="button">あとで</button>' +
        '</div>' +
      '</div>';

    openModal(html);

    /* 「見た」フラグの保存。マイページを開いた／閉じたのいずれでも保存し、
       再表示を抑止する。 */
    function markSeen() {
      try { localStorage.setItem('mm2026_intro_seen_v1', '1'); } catch (e) {}
    }
    const openBtn = document.getElementById('introOpenBtn');
    const closeBtn = document.getElementById('thanksCloseBtn');
    if (openBtn) openBtn.addEventListener('click', () => {
      markSeen();
      closeModal();
      setTimeout(() => switchView('myplan'), 50);
    });
    if (closeBtn) closeBtn.addEventListener('click', () => {
      markSeen();
      closeModal();
    });
    const bg = document.getElementById('modalBg');
    if (bg && typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        if (!bg.classList.contains('open')) {
          markSeen();
          obs.disconnect();
        }
      });
      obs.observe(bg, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function openArtist(id) {
    const a = ARTISTS.find(x => x.id === id); if (!a) return;
    pushRecent('artists', a.id);
    const faved = isFav('artists', a.id);
    const dt = artistDaysText(a);
    openModal(
      `<div class="modal__handle"></div>
       <div class="modal__cat">🎤</div>
       <div class="modal__title">${esc(a.name)}</div>
       <div class="modal__sub">出演アーティスト</div>
       <div class="modal__row"><div class="ico">🗓</div><div>
         <div class="k">出演日</div>
         <div class="v">${dt ? esc(dt) : '公式タイムテーブルでご確認ください'}</div></div></div>
       <div class="modal__row"><div class="ico">🕒</div><div>
         <div class="k">ステージ・時間</div>
         <div class="v" style="font-size:12px">公式タイムテーブルでご確認ください</div></div></div>
       <div class="modal__btns">
         <button class="btn btn--fav ${faved ? 'on' : ''}" id="mFav">
           ${faved ? '★ 登録済み' : '☆ マイプランに追加'}</button></div>
       <div class="modal__btns">
         <button class="btn btn--primary" id="mTT">🕒 公式タイムテーブルを見る</button></div>`);
    $('#mFav').onclick = () => {
      toast(toggleFav('artists', a.id) ? '★ マイプランに追加' : 'マイプランから削除');
      saveFav(); openArtist(id); updateTabBadge();
      if (state.view === 'artists') renderArtistList();
      if (state.view === 'myplan') renderMyplan();
    };
    $('#mTT').onclick = () => {
      closeModal();
      openUrl(FESTIVAL.links.timetable);
    };
  }

  function openShop(id) {
    const s = SHOPS.find(x => x.id === id); if (!s) return;
    pushRecent('shops', s.id);
    const visited = isVisited(s.id);
    const nextYr = isNextYear(s.id);
    const note = getNote(s.id);
    const tagsHtml = NOTE_TAGS.map(t => {
      const on = note.tags.indexOf(t) !== -1;
      return `<button type="button" class="chip ${on ? 'active' : ''}" data-note-tag="${esc(t)}">${esc(t)}</button>`;
    }).join('');
    openModal(
      `<div class="modal__handle"></div>
       <div class="modal__cat">${s.catIcon}</div>
       <div class="modal__title">${esc(s.name)}</div>
       <div class="modal__sub">出店ショップ</div>
       <div class="modal__row"><div class="ico">📍</div><div>
         <div class="k">出店エリア</div><div class="v">${esc(s.zoneName)}</div></div></div>
       ${s.hasMapPos && s.booth ? `<div class="modal__row"><div class="ico">🔢</div><div>
         <div class="k">公式会場マップ ブース番号</div>
         <div class="v">${esc(shortName(s.zoneName))} ${s.booth}番</div></div></div>` : ''}
       ${s.days ? `<div class="modal__row"><div class="ico">📅</div><div>
         <div class="k">出店日</div>
         <div class="v">${s.days.map(id => {
           const d = FESTIVAL.days.find(x => x.id === id);
           return d ? d.label + '(' + ({FRI:'金',SAT:'土',SUN:'日'}[d.dow] || d.dow) + ')' : id;
         }).join('・')}のみ</div></div></div>` : ''}
       <div class="modal__btns modal__btns--double">
         <button class="btn btn--visited ${visited ? 'on' : ''}" id="sVisited" title="行った／訪問済み">${visited ? '✅ 行った' : '⬜ 行った'}</button>
         <button class="btn btn--nextyear ${nextYr ? 'on' : ''}" id="sNextYr" title="来年も行きたい">${nextYr ? '🌱 来年' : '🌿 来年'}</button>
       </div>
       <div class="note-block">
         <div class="note-block__head">📝 メモ・おすすめ</div>
         <div class="chips note-block__tags" id="sNoteTags">${tagsHtml}</div>
         <textarea class="note-block__body" id="sNoteBody" maxlength="500" placeholder="例：◯◯がおすすめ／また来たい／開場すぐ売り切れ など（500字まで）">${esc(note.body)}</textarea>
         <div class="note-block__count"><span id="sNoteCount">${noteBodyLen(note.body)}</span> / 500</div>
       </div>
       <div class="modal__btns">
         <button class="btn btn--ghost" id="sShare">↗ この出店をシェア</button>
       </div>`);
    $('#sVisited').onclick = () => {
      toast(toggleVisited(s.id) ? '✅ 行ったに追加' : '行ったから削除');
      saveVisited(); openShop(id); updateTabBadge();
      if (state.view === 'shops') renderShopList();
      if (state.view === 'myplan') renderMyplan();
    };
    $('#sNextYr').onclick = () => {
      toast(toggleNextYear(s.id) ? '🌱 来年に追加' : '来年から削除');
      saveNextYear(); openShop(id); updateTabBadge();
      if (state.view === 'shops') renderShopList();
      if (state.view === 'myplan') renderMyplan();
    };
    /* メモ：タグはクリックで toggle、本文は入力で debounce 保存 */
    $$('#sNoteTags .chip').forEach(c => c.onclick = (e) => {
      e.preventDefault();
      const t = c.getAttribute('data-note-tag');
      const cur = getNote(s.id);
      const i = cur.tags.indexOf(t);
      const added = i === -1;
      if (added) cur.tags.push(t); else cur.tags.splice(i, 1);
      setNote(s.id, cur);
      c.classList.toggle('active');
      scheduleSaveNotes(0);  /* タグ toggle は即保存 */
      /* 保存されたことが伝わるよう toast を即出す */
      toast((added ? '＃' : '× ') + t);
      if (state.view === 'shops') renderShopList();
      if (state.view === 'myplan') renderMyplan();
    });
    const sNoteBody = $('#sNoteBody');
    const sNoteCount = $('#sNoteCount');
    if (sNoteBody) {
      sNoteBody.oninput = () => {
        /* コードポイント単位で 500 字に切り詰め、絵文字の二重カウントを防ぐ */
        const arr = [...sNoteBody.value];
        let v = arr.length > 500 ? arr.slice(0, 500).join('') : sNoteBody.value;
        if (v !== sNoteBody.value) sNoteBody.value = v;
        if (sNoteCount) sNoteCount.textContent = String(noteBodyLen(v));
        const cur = getNote(s.id);
        cur.body = v;
        setNote(s.id, cur);
        scheduleSaveNotes(500);
      };
      /* モーダルを閉じる前に未確定の保存を確定させる（メモ即時保存の保険） */
      sNoteBody.onblur = () => { scheduleSaveNotes(0); };
    }
    const sShare = $('#sShare');
    if (sShare) sShare.onclick = () => {
      shareOrCopy({
        title: s.name + ' @森道市場2026',
        text: '『' + s.name + '』@ ' + shortName(s.zoneName) + ' — わたしの森道 2026',
        url: APP_URL + '#shop=' + encodeURIComponent(s.id)
      });
    };
  }

  /* ============================================================
     初期化
  ============================================================ */
  function init() {
    sanitizeState();
    /* 検索用キーを事前計算（毎キーストロークの再計算を避ける）。
       nk … 名前の正規化キー（既存互換）
       nkRoma / aliasNk / aliasRoma … 英⇄カナ相互検索用の補助キー。
       アーティストは50音順にソートしておく。 */
    SHOPS.forEach(s => {
      var k = buildSearchKeys(s.name, s.aliases);
      s.nk = k.nk; s.nkRoma = k.nkRoma;
      s.aliasNk = k.aliasNk; s.aliasRoma = k.aliasRoma;
    });
    ARTISTS.forEach(a => {
      var k = buildSearchKeys(a.name, a.aliases);
      a.nk = k.nk; a.nkRoma = k.nkRoma;
      a.aliasNk = k.aliasNk; a.aliasRoma = k.aliasRoma;
    });
    ARTISTS.sort((a, b) => a.name.localeCompare(b.name, 'ja'));

    applyNight();
    renderHeader();
    tickClock();
    setInterval(tickClock, 10000);
    $('#nightBtn').onclick = () => {
      state.night = !state.night;
      try { localStorage.setItem('mm2026_night', state.night ? '1' : '0'); }
      catch (e) {}
      applyNight();
    };
    $$('.tabbar button').forEach(b => b.onclick = () => switchView(b.dataset.view));
    $('#modalBg').onclick = e => { if (e.target.id === 'modalBg') closeModal(); };
    /* モーダル：Escape で閉じる／端末の戻る操作（popstate）で閉じる */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && $('#modalBg').classList.contains('open')) closeModal();
    });
    window.addEventListener('popstate', () => { if (modalOpen) closeModal(true); });
    /* バックグラウンド復帰時：時計を即更新 */
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { tickClock(); }
    });
    switchView('myplan');
    updateTabBadge();
    /* シェアURL（#shop=sN）で来訪した場合、該当出店のモーダルを自動で開く。
       hash はモーダル表示後に消し、リロードで何度も開く挙動を防ぐ。
       hash 来訪時は初回ポップアップとの競合を避けるため、ポップアップを抑止する。 */
    let hashHandled = false;
    try {
      const h = (location.hash || '').replace(/^#/, '');
      const m = /^shop=(.+)$/.exec(h);
      if (m) {
        const target = decodeURIComponent(m[1]);
        if (SHOPS.some(s => s.id === target)) {
          hashHandled = true;
          /* リロード時のループを防ぐため hash を即削除 */
          try { history.replaceState({}, '', location.pathname + location.search); } catch (e) {}
          setTimeout(() => openShop(target), 200);
        }
      }
    } catch (e) {}
    /* 初期描画が落ち着いてからお礼ポップアップを評価（一度きり表示）。
       hash で出店モーダルを開いている場合はポップアップを抑止する。 */
    if (!hashHandled) {
      setTimeout(showThanksPopupIfFirst, 300);
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
