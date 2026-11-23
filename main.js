// =====================================================================
// main.js
// ランナーゲーム(index.html から読み込まれる)
//
// ワシが道を走り、建物はジャンプで、カモメは↓でしゃがんでよける横スクロールゲーム。
// 実際にはワシは画面の左側から動かず、建物やカモメや道の線が左へ流れてくることで
// 「ワシが右へ走っている」ように見せている。
//
// プログラム全体の流れ:
//   1. 準備      … 画面(canvas)・定数・画像を用意する
//   2. 状態      … スコアや障害物など、ゲーム中に変わる値を用意する
//   3. 入力      … キーやタップを受け取る
//   4. 更新      … 時間を進めて、位置・速さ・当たり判定を計算する
//   5. 描画      … 計算した結果を画面に描く
//   6. 効果音
//   7. ハイスコアの保存
//   8. メインループ … 「更新 → 描画」を1秒に約60回くり返す
//
// 座標の決まり(canvas の座標):
//   左上が (0, 0)。x は右へ行くほど大きく、y は「下へ」行くほど大きい。
//   そのため「上へ動く」=「y を小さくする」、上向きの速さはマイナスになる。
// =====================================================================


// ===== 1. 準備 =====

// index.html の <canvas id="game"> を取ってくる
const canvas = document.getElementById("game");
// ctx(コンテキスト)は「絵を描く道具」。ctx.fillRect() や ctx.drawImage() で描く
const ctx = canvas.getContext("2d");

const W = canvas.width;    // 画面の幅 800(index.html の width="800")
const H = canvas.height;   // 画面の高さ 300(index.html の height="300")
const GROUND_Y = 250;      // 地面(道の上の端)の位置。y=250 より下が道になる

// const は「あとで変えない値(定数)」。数字を変えるとゲームの感触が変わる
const GRAVITY = 2400;      // 重力 [px/秒^2]  … 1秒ごとに落ちる速さが 2400px/秒 ずつ増える
const JUMP_POWER = 820;    // ジャンプの勢い [px/秒] … 大きいほど高く跳ぶ
const START_SPEED = 360;   // 最初のスクロールの速さ [px/秒] … 1秒で360px進む
const MAX_SPEED = 900;     // 最高の速さ [px/秒] … これ以上は速くならない

// 画像の読み込み。new Image() で画像の入れ物を作り、src にファイル名を入れると読み込みが始まる
// (読み込みが終わる前に描こうとしても、何も描かれないだけでエラーにはならない)

// ワシの画像(元の写真の白い背景を透明にしたもの)
const eagleImg = new Image();
eagleImg.src = "character.png";
// 障害物の建物の画像(元の写真の外側の白い背景を透明にしたもの)
const buildingImg = new Image();
buildingImg.src = "building.png";
// カモメの画像(JPG なので周りは白い四角。背景が白なので目立たない)
const gullImg = new Image();
gullImg.src = "bird.jpg";


// ===== 2. ゲームの状態 =====
// let は「あとで変わる値(変数)」

let state = "title";       // 今の画面:"title"(タイトル)/ "play"(プレイ中)/ "over"(ゲームオーバー)
let speed;                 // 今のスクロールの速さ [px/秒]
let distance;              // スタートから進んだ距離 [px]
let score;                 // スコア(進んだ距離から計算する)
let nextGap;               // 次の障害物を出すまでに、あと何 px 進むか
let overTime;              // ゲームオーバーになった時刻 [秒]
let obstacles = [];        // 画面にある障害物(建物とカモメ)を入れておく配列
let time = 0;              // ゲームを開いてからの経過時間 [秒]
let highScore = loadHighScore();   // ハイスコア(ブラウザに保存してある値を読み込む。下の 7. を参照)

// ワシの情報をまとめたオブジェクト
//   x, y     … 位置。y は「足元」の高さ(頭の位置ではない)
//   w, h     … 当たり判定の四角の幅と高さ(画像の大きさより小さい)
//   vy       … 縦の速さ [px/秒]。マイナスなら上へ、プラスなら下へ動いている
//   onGround … 地面に立っているか(true / false)
//   sliding  … しゃがんでいるか(true / false)
const eagle = { x: 90, y: GROUND_Y, w: 40, h: 50, vy: 0, onGround: true, sliding: false };

// ゲームを最初の状態に戻す(スタートするたびに呼ぶ)
function resetGame() {
    speed = START_SPEED;
    distance = 0;
    score = 0;
    nextGap = 400;         // 最初の障害物は 400px 進んだところで出す
    obstacles = [];        // 障害物を全部消す
    eagle.y = GROUND_Y;    // ワシを地面に戻す
    eagle.vy = 0;
    eagle.onGround = true;
}
resetGame();               // 最初に1回呼んで、変数に値を入れておく


// ===== 3. キー入力 =====

// 押されているキーを覚えておく入れ物。例:↓を押している間は keys["ArrowDown"] が true
const keys = {};

// キーが押されたとき
document.addEventListener("keydown", (e) => {
    // スペースや矢印キーは、そのままだとページがスクロールしてしまうので止める
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    keys[e.code] = true;
    // スペースか↑ならジャンプ(タイトル画面・ゲームオーバー画面ではスタート)
    if (e.code === "Space" || e.code === "ArrowUp") pressJump();
});

// キーが離されたとき
document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

// スマホ:画面をタップでジャンプ(パソコンでもクリックでジャンプできる)
canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();    // タップでの拡大などを止める
    pressJump();
});

// ジャンプボタンが押されたときの処理
function pressJump() {
    if (state === "title" || (state === "over" && time - overTime > 0.5)) {
        // タイトル画面かゲームオーバー画面なら、ゲームをスタートする
        // (ゲームオーバー直後は、ジャンプの連打で勝手に始まらないよう 0.5 秒待つ)
        resetGame();
        state = "play";
    } else if (state === "play" && eagle.onGround) {
        // プレイ中で地面にいるときだけジャンプできる(空中ではもう一度跳べない)
        eagle.vy = -JUMP_POWER;   // 上向き(マイナス)の速さを与える
        eagle.onGround = false;
        beep(660, 0.1);           // ジャンプの音
    }
}


// ===== 4. 更新(計算) =====
// dt は「前回の更新からたった時間 [秒]」。約 1/60 秒 = 0.0166 秒。
// 「速さ × dt」で、その間に動く距離が求まる。
// こうしておくと、パソコンの性能で1秒あたりの回数が変わっても、ゲームの速さは同じになる。

function update(dt) {
    time += dt;                       // 経過時間を進める
    if (state !== "play") return;     // プレイ中でなければ、ここで終わり(何も動かさない)

    speed = Math.min(MAX_SPEED, speed + 10 * dt); // 1秒ごとに 10px/秒 ずつ速くなる(最高 MAX_SPEED)
    distance += speed * dt;                       // 進んだ距離を足す
    score = Math.floor(distance / 10);            // 10px 進むごとに 1点(Math.floor で小数を切り捨て)

    updateEagle(dt);       // ワシを動かす
    updateObstacles(dt);   // 障害物を出す・動かす
    checkHits();           // ぶつかったか調べる
}

// ワシの動き(しゃがみ・ジャンプ・落下)
function updateEagle(dt) {
    // ↓を押している間、地面の上ならしゃがむ
    eagle.sliding = keys["ArrowDown"] && eagle.onGround;
    // しゃがむと当たり判定の高さが 50 → 26 に低くなり、カモメの下をくぐれる
    // (「条件 ? A : B」は、条件が true なら A、false なら B という書き方)
    eagle.h = eagle.sliding ? 26 : 50;

    if (!eagle.onGround) {
        // 空中にいるとき:重力で下向きの速さが増えていく(↓を押していると 2.5 倍の重力で早く落ちる)
        eagle.vy += GRAVITY * (keys["ArrowDown"] ? 2.5 : 1) * dt;
        // 速さの分だけ位置を動かす
        eagle.y += eagle.vy * dt;
        // 地面より下まで来たら、地面の上に止める(着地)
        if (eagle.y >= GROUND_Y) {
            eagle.y = GROUND_Y;
            eagle.vy = 0;
            eagle.onGround = true;
        }
    }
}

// 障害物を出す・動かす・消す
function updateObstacles(dt) {
    // 進んだ分だけ nextGap を減らし、0 以下になったら次の障害物を右端に出す
    nextGap -= speed * dt;
    if (nextGap <= 0) {
        spawnObstacle();
        // 次の障害物までの間隔を決める:320〜700px のランダム + 速さに応じた分
        // (速くなるほど間隔を広げて、ジャンプが間に合うようにする)
        nextGap = 320 + Math.random() * 380 + speed * 0.3;
    }
    // すべての障害物を左へ動かす(カモメは道より 80px/秒 速く飛んでくる)
    for (const o of obstacles) o.x -= (o.type === "gull" ? speed + 80 : speed) * dt;
    // 画面の左の外に出たものは配列から消す(filter は条件に合うものだけを残す)
    obstacles = obstacles.filter((o) => o.x + o.w > -50);
}

// 新しい障害物を1つ作って、画面の右の外(x = W + 20)に置く
function spawnObstacle() {
    // Math.random() は 0 以上 1 未満のランダムな数。「< 0.3」なら 30% の確率
    if (score > 150 && Math.random() < 0.3) {
        // カモメ(スコアが 150 を超えてから、30% の確率で出る)
        // y = GROUND_Y - 62 の高さを飛ぶ。カモメの下の端は地面から 36px 上:
        //   立っているワシ(高さ 50)には当たり、しゃがんだワシ(高さ 26)はくぐれる
        obstacles.push({ type: "gull", x: W + 20, y: GROUND_Y - 62, w: 44, h: 26 });
    } else {
        // 建物:高さは 40〜65px のランダム。幅は画像の縦横比 259:228 に合わせて計算する
        const h = 40 + Math.random() * 25;
        const w = h * 259 / 228;
        // y は建物の上の端。地面(GROUND_Y)から高さ h だけ上
        obstacles.push({ type: "building", x: W + 20, y: GROUND_Y - h, w: w, h: h });
    }
}

// 2つの四角形 a, b が重なっているか調べる(重なっていれば true)
// 「a の左端が b の右端より左」かつ「a の右端が b の左端より右」なら横方向で重なっている。
// 縦方向も同じように調べ、両方とも重なっていれば、四角形どうしが重なっている。
function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
        a.y < b.y + b.h && a.y + a.h > b.y;
}

// ワシと障害物がぶつかったか調べる
function checkHits() {
    // ワシの当たり判定の四角を作る。
    // eagle.y は足元なので、四角の上の端は eagle.y - eagle.h。
    // さらに四方を 4px ずつ小さくして、ギリギリでよけられるようにしている
    const p = { x: eagle.x + 4, y: eagle.y - eagle.h + 4, w: eagle.w - 8, h: eagle.h - 8 };
    for (const o of obstacles) {
        if (hit(p, o)) {
            gameOver();
            return;        // 1つでも当たったら、それ以上は調べない
        }
    }
}

// ゲームオーバーにする
function gameOver() {
    state = "over";
    overTime = time;       // ゲームオーバーの時刻を覚える(すぐ再スタートしないため)
    beep(160, 0.4);        // 低い音
    // ハイスコアを超えていたら更新して、ブラウザに保存する
    if (score > highScore) {
        highScore = score;
        saveHighScore(highScore);
    }
}


// ===== 5. 描画 =====
// 毎回、画面全体を描き直す(パラパラ漫画と同じ)。
// あとから描いたものが上に重なるので、「背景 → 障害物 → ワシ → スコア → メッセージ」の順に描く。

function draw() {
    drawBackground();
    for (const o of obstacles) {
        // ctx.drawImage(画像, 左上の x, 左上の y, 幅, 高さ) で画像を描く
        if (o.type === "building") ctx.drawImage(buildingImg, o.x, o.y, o.w, o.h);
        else ctx.drawImage(gullImg, o.x - 7, o.y, 50, 26); // カモメ(画像を当たり判定より少し左から描く)
    }
    drawEagle();
    drawScore();
    // タイトル画面・ゲームオーバー画面のときは、上にメッセージを重ねる
    if (state === "title") drawMessage("ランナーゲーム", "スペースキー / タップでスタート");
    // `...${score}...` のように ` (バッククォート)で囲むと、${ } の中に変数の値を入れられる
    if (state === "over") drawMessage("ゲームオーバー", `スコア ${score}  スペースキー / タップでもう一度`);
}

// 背景と道を描く
function drawBackground() {
    // 背景:画面全体を白でぬる(前の絵を消す役目もある)
    ctx.fillStyle = "#ffffff";             // ぬる色を決める
    ctx.fillRect(0, 0, W, H);              // fillRect(左上の x, 左上の y, 幅, 高さ) で四角をぬる

    // 地面(灰色の道):y = GROUND_Y から画面の下までの四角
    ctx.fillStyle = "#6c757d";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

    // 道の真ん中の白い破線(長さ 50px の線を 100px おきに並べる)
    // distance % 100 は「進んだ距離を 100 で割った余り」(0〜99)。
    // その分だけ左にずらして描くので、進むにつれて線が左へ流れ、100px ずれると元の形に戻る
    ctx.fillStyle = "#ffffff";
    for (let x = -(distance % 100); x < W; x += 100) {
        ctx.fillRect(x, GROUND_Y + 23, 50, 4);
    }
}

// ワシの画像を描く
function drawEagle() {
    // しゃがんでいる間は、画像を低く(高さ 66 → 30 に)つぶして描く
    const h = eagle.sliding ? 30 : 66;
    // 画像は幅 78px。当たり判定(幅 40px)より広いので 16px 左から描き、体が判定の上に来るようにする。
    // 上の端は「足元 - 高さ」
    ctx.drawImage(eagleImg, eagle.x - 16, eagle.y - h, 78, h);
}

// 右上にハイスコアとスコアを描く
function drawScore() {
    ctx.fillStyle = "#1d3557";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "right";               // 指定した x を文字の「右端」にする
    // padStart(5, "0") で 5けたになるよう前に 0 をつける(例:42 → "00042")
    ctx.fillText(`HI ${String(highScore).padStart(5, "0")}  ${String(score).padStart(5, "0")}`, W - 16, 32);
}

// 画面の真ん中に大きな文字(title)と小さな文字(sub)を描く
function drawMessage(title, sub) {
    // 半透明の紺色で画面全体をおおう(rgba の最後の 0.55 が不透明度)
    ctx.fillStyle = "rgba(29, 53, 87, 0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";              // 指定した x を文字の「真ん中」にする
    ctx.font = "bold 36px sans-serif";
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.font = "18px sans-serif";
    ctx.fillText(sub, W / 2, H / 2 + 26);
}


// ===== 6. 効果音(Web Audio API で短い音を鳴らす) =====
// 音のファイルは使わず、ブラウザの機能で「ピッ」という音を作っている。

let audio = null;          // 音を鳴らす道具(最初の1回だけ作る)

// freq:音の高さ [Hz](大きいほど高い音) length:鳴らす長さ [秒]
function beep(freq, length) {
    try {
        if (!audio) audio = new AudioContext();
        const osc = audio.createOscillator();   // 発振器:決まった高さの音を出し続ける
        const gain = audio.createGain();        // 音量を調整する部品
        osc.type = "square";                    // 四角い波形(ファミコンのような音)
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, audio.currentTime);                         // 最初の音量(小さめ)
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length); // だんだん小さくする
        osc.connect(gain).connect(audio.destination);   // 発振器 → 音量 → スピーカー の順につなぐ
        osc.start();
        osc.stop(audio.currentTime + length);   // length 秒後に止める
    } catch (e) {
        // 音が使えない環境では何もしない(try … catch でエラーを受け止め、ゲームは止めない)
    }
}


// ===== 7. ハイスコアの保存 =====
// ハイスコアはファイルではなく、ブラウザの「localStorage」という保存場所に
// "eagleHighScore" という名前で保存する。ブラウザを閉じても残る。
// localStorage が使えない環境(設定で禁止されている等)でも動くように try で囲んでいる。

// 保存してあるハイスコアを読み込む(保存がなければ 0)
function loadHighScore() {
    try {
        // getItem は文字列を返すので Number() で数に直す。何もなければ || 0 で 0 にする
        return Number(localStorage.getItem("eagleHighScore")) || 0;
    } catch (e) {
        return 0;
    }
}

// ハイスコアを保存する
function saveHighScore(value) {
    try {
        localStorage.setItem("eagleHighScore", String(value));   // 文字列にして保存する
    } catch (e) {
        // 保存できなくてもゲームは続ける
    }
}

// ハイスコアをリセットする(index.html の「ハイスコアをリセット」ボタン)
const resetHighButton = document.getElementById("reset-high");
resetHighButton.addEventListener("click", () => {
    // confirm() は「OK / キャンセル」を聞く小さな画面を出す。OK なら true
    if (confirm("ハイスコアを 0 に戻しますか?")) {
        highScore = 0;
        saveHighScore(0);
    }
    // ボタンにフォーカスが残ると、スペースキーでまたボタンが押されてしまうので外す
    resetHighButton.blur();
});


// ===== 8. メインループ(1秒に約60回「更新 → 描画」を繰り返す) =====
// requestAnimationFrame(関数) は「次に画面を書きかえるタイミングで、この関数を呼んで」という命令。
// loop の最後でもう一度 requestAnimationFrame(loop) を呼ぶので、loop がずっとくり返される。

let lastTime = performance.now();   // 前回 loop が呼ばれた時刻 [ミリ秒]

// now:今の時刻 [ミリ秒](ブラウザが自動で渡してくれる)
function loop(now) {
    // 前回からの経過秒数(ミリ秒 ÷ 1000 = 秒)。
    // タブを切りかえて戻ったときなどに大きくなりすぎてワシが飛ぶのを防ぐため、最大 0.05 秒にする
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    update(dt);    // 計算して
    draw();        // 描いて
    requestAnimationFrame(loop);    // 次の回を予約する
}
requestAnimationFrame(loop);        // ここでループを始める
