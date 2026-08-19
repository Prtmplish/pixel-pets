const vscode = require('vscode');

const SPECIES = ['cat', 'dog', 'fox', 'ghost'];
const THEMES = ['forest', 'night', 'snow'];

/**
 * A webview view that docks in the Explorer. The whole scene — sky, trees, ground,
 * weather, and the pet itself — is drawn with fillRect on a low-resolution canvas that
 * is scaled up with `image-rendering: pixelated`, so there are no image assets to ship.
 */
class PetViewProvider {
  /** @param {vscode.ExtensionContext} context */
  constructor(context) {
    this.context = context;
    /** @type {vscode.WebviewView | undefined} */
    this.view = undefined;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);

    view.webview.onDidReceiveMessage((msg) => {
      if (!msg) return;
      if (msg.type === 'caught' || msg.type === 'petted') this.reward(msg.type);
    }, undefined, this.context.subscriptions);

    view.onDidDispose(() => { this.view = undefined; }, null, this.context.subscriptions);
  }

  post(message) {
    if (this.view) this.view.webview.postMessage(message);
  }

  /** Push the current settings into the scene without rebuilding the webview. */
  sync() {
    const cfg = vscode.workspace.getConfiguration('pets');
    this.post({
      type: 'config',
      species: SPECIES.includes(cfg.get('species', 'cat')) ? cfg.get('species', 'cat') : 'cat',
      theme: THEMES.includes(cfg.get('theme', 'forest')) ? cfg.get('theme', 'forest') : 'forest'
    });
  }

  throwBall() {
    this.post({ type: 'ball' });
    if (this.view) this.view.show(true);
  }

  reward(kind) {
    const key = kind === 'caught' ? 'pets.catches' : 'pets.pats';
    const n = this.context.globalState.get(key, 0) + 1;
    this.context.globalState.update(key, n);
    if (this.onReward) this.onReward();
  }

  html(webview) {
    const nonce = makeNonce();
    const cfg = vscode.workspace.getConfiguration('pets');
    const initial = JSON.stringify({
      species: cfg.get('species', 'cat'),
      theme: cfg.get('theme', 'forest')
    });

    return [
      '<!DOCTYPE html>',
      '<html lang="en"><head>',
      '<meta charset="UTF-8">',
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; ' +
        'style-src ' + webview.cspSource + " 'unsafe-inline'; script-src 'nonce-" + nonce + "';\">",
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '<style>',
      STYLE,
      '</style></head><body>',
      '<div id="stage"><canvas id="scene"></canvas></div>',
      '<div id="hint">click to throw a ball · click the pet to pet it</div>',
      '<script nonce="' + nonce + '">',
      'var INITIAL = ' + initial + ';',
      SCRIPT,
      '</script></body></html>'
    ].join('\n');
  }
}

function makeNonce() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
  return out;
}

const STYLE = [
  'html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; }',
  '#stage { width: 100%; line-height: 0; cursor: pointer; }',
  '#scene { display: block; width: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }',
  '#hint {',
  '  font-family: var(--vscode-font-family); font-size: 10px; opacity: .45;',
  '  color: var(--vscode-foreground); padding: 4px 6px 6px; text-align: center;',
  '  user-select: none;',
  '}'
].join('\n');

/* ------------------------------------------------------------------ scene */

const SCRIPT = String.raw`
var vscodeApi = acquireVsCodeApi();
var canvas = document.getElementById('scene');
var ctx = canvas.getContext('2d');
var stage = document.getElementById('stage');

var SCALE = 3;
var H = 58;
var W = 96;
var GROUND = H - 13;

var species = INITIAL.species || 'cat';
var theme = INITIAL.theme || 'forest';

var THEMES = {
  forest: {
    sky: ['#3b2440', '#553049', '#6d4053', '#8a5559'],
    far: ['#7c4a5d', '#94596a'],
    trunk: '#4a2b39',
    canopy: ['#c9683f', '#e59a44', '#f3c86d', '#f8e3ae'],
    ground: ['#2b1a2d', '#3d2539', '#4d2f42'],
    grass: '#7a4b45',
    fg: '#1d1220',
    fleck: ['#e59a44', '#c9683f', '#f3c86d'],
    flecks: 26, drift: 0.10, fall: 0.14, sky_extra: null
  },
  night: {
    sky: ['#0d1026', '#141a3a', '#1d2450', '#2a3163'],
    far: ['#232a55', '#2d3567'],
    trunk: '#161a33',
    canopy: ['#1f2a4a', '#28365c', '#324372', '#3d5290'],
    ground: ['#0a0c1c', '#121732', '#1a2141'],
    grass: '#2a3358',
    fg: '#05060f',
    fleck: ['#ffe9a3', '#fff6d6', '#c9d8ff'],
    flecks: 16, drift: 0.22, fall: -0.02, sky_extra: 'stars'
  },
  snow: {
    sky: ['#26364f', '#37506e', '#4b6a8b', '#6d90ab'],
    far: ['#4e6d88', '#5f809b'],
    trunk: '#37455c',
    canopy: ['#4e6d88', '#7d9ab2', '#adc6d8', '#e8f2f8'],
    ground: ['#8fa8bd', '#c3d6e3', '#eaf4fa'],
    grass: '#9db4c6',
    fg: '#63809a',
    fleck: ['#ffffff', '#e8f2f8', '#cfe2ee'],
    flecks: 34, drift: 0.12, fall: 0.20, sky_extra: null
  }
};
var PALETTES = {
  cat:   { x: '#8d7f9e', d: '#5d5171', l: '#d9d0e2', e: '#241a2b', n: '#e58c9a' },
  dog:   { x: '#b57a4a', d: '#794d2b', l: '#e9d0af', e: '#2b1c12', n: '#3b2419' },
  fox:   { x: '#e0824a', d: '#a3532c', l: '#f7e5d0', e: '#2b1a12', n: '#33211a' },
  ghost: { x: '#dfe6f2', d: '#9aa6bd', l: '#ffffff', e: '#2b2b3a', n: '#2b2b3a' }
};

var BODIES = {
  cat: [
    '...........x..x.',
    '..........xxxxxx',
    '..........xxxxxx',
    '...xxxxxxxxxexxn',
    '..xxxxxxxxxxxxxx',
    '..xxxxxxxxxxxxx.',
    '..llxxxxxxxxxx..',
    '...xxxxxxxxxx...'
  ],
  dog: [
    '................',
    '..........xxxxx.',
    '.........dxxxxxx',
    '...xxxxxxdxxexxn',
    '..xxxxxxxdxxxxxx',
    '..xxxxxxxxxxxxx.',
    '..llxxxxxxxxxx..',
    '...xxxxxxxxxx...'
  ],
  fox: [
    '..........x...x.',
    '..........xx.xx.',
    '.........xxxxxxx',
    '...xxxxxxxxxexxn',
    '..xxxxxxxxxxxxxx',
    '..xxxxxxxxxxxxl.',
    '..llxxxxxxxxxl..',
    '...xxxxxxxxxx...'
  ],
  ghost: [
    '.....xxxxxx.....',
    '....xxxxxxxx....',
    '...xxexxxxexx...',
    '...xxxxxxxxxx...',
    '...llxxxxxxxx...',
    '...xxxxxxxxxx...',
    '...xxxxxxxxxx...',
    '...x.xx.xx.xx...'
  ]
};

/* --------------------------------------------------------------- helpers */

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function disc(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (var dy = -r; dy <= r; dy++) {
    var w = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
  }
}

/* ------------------------------------------------------------ background */

var bg = document.createElement('canvas');

function buildBackground() {
  var t = THEMES[theme];
  bg.width = W; bg.height = H;
  var g = bg.getContext('2d');
  var rnd = mulberry32(20260819);

  var bands = t.sky.length;
  for (var i = 0; i < bands; i++) {
    g.fillStyle = t.sky[i];
    var y0 = Math.floor((GROUND * i) / bands);
    var y1 = Math.floor((GROUND * (i + 1)) / bands);
    g.fillRect(0, y0, W, y1 - y0);
  }

  if (t.sky_extra === 'stars') {
    for (var s = 0; s < Math.floor(W / 3); s++) {
      g.fillStyle = rnd() > 0.75 ? '#ffffff' : '#b9c6ee';
      g.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * (GROUND - 14)), 1, 1);
    }
    disc(g, W - 14, 11, 5, '#f6f2d8');
    disc(g, W - 12, 9, 5, t.sky[0]);
  }

  // one tree: a trunk that stops short of its canopy, then stacked blobs on top
  function tree(tx, baseY, height, r, shade, lit) {
    var top = baseY - height;
    g.fillStyle = shade.trunk;
    var tw = r > 5 ? 2 : 1;
    g.fillRect(tx, top + Math.floor(r * 0.7), tw, baseY - top - Math.floor(r * 0.7));
    if (r > 5 && rnd() > 0.55) {
      var by = top + r + 2 + Math.floor(rnd() * 4);
      g.fillRect(tx - 2, by, 2, 1);
    }
    disc(g, tx, top + r - 1, r, shade.c[0]);
    disc(g, tx - r + 2, top + r + 1, Math.max(2, r - 2), shade.c[0]);
    disc(g, tx + r - 2, top + r, Math.max(2, r - 2), shade.c[1]);
    disc(g, tx + 1, top + 1, Math.max(2, r - 1), shade.c[1]);
    if (lit) {
      disc(g, tx - Math.floor(r / 2), top + 1, Math.max(1, r - 3), shade.c[2]);
      disc(g, tx - Math.floor(r / 2) + 1, top, Math.max(1, r - 5), shade.c[3]);
    }
  }

  var far = { trunk: t.far[0], c: [t.far[0], t.far[1], t.far[1], t.far[1]] };
  var near = { trunk: t.trunk, c: t.canopy };

  // back row: small, flat-coloured, packed tight — reads as distance
  var x = -6;
  while (x < W + 8) {
    tree(Math.round(x), GROUND - 1 - Math.floor(rnd() * 2), 9 + Math.floor(rnd() * 6),
      3 + Math.floor(rnd() * 2), far, false);
    x += 4 + rnd() * 5;
  }

  // front row: tall, lit, irregularly spaced so it never reads as a fence
  x = -4;
  while (x < W + 10) {
    var r = 4 + Math.floor(rnd() * 4);
    var h = 20 + Math.floor(rnd() * 14);
    tree(Math.round(x), GROUND + Math.floor(rnd() * 2), h, r, near, true);
    x += 6 + rnd() * 12;
  }

  // ground
  g.fillStyle = t.ground[0];
  g.fillRect(0, GROUND, W, H - GROUND);
  g.fillStyle = t.ground[1];
  g.fillRect(0, GROUND, W, 3);
  g.fillStyle = t.ground[2];
  g.fillRect(0, GROUND, W, 1);
  // clumped tufts along the path, not an even speckle
  var tufts = Math.floor(W / 6);
  for (var u = 0; u < tufts; u++) {
    var gx = Math.floor(rnd() * W);
    g.fillStyle = t.grass;
    g.fillRect(gx, GROUND + 2, 1, 2);
    if (rnd() > 0.4) g.fillRect(gx - 1, GROUND + 3, 1, 1);
    if (rnd() > 0.4) g.fillRect(gx + 1, GROUND + 3, 1, 1);
    if (rnd() > 0.88) { g.fillStyle = t.fleck[0]; g.fillRect(gx, GROUND + 1, 1, 1); }
  }

  // foreground silhouettes, cropped by the bottom edge — the near end of the depth stack
  var bx = -2;
  while (bx < W + 6) {
    var br = 3 + Math.floor(rnd() * 4);
    disc(g, Math.round(bx), H + 1, br, t.fg);
    disc(g, Math.round(bx) + br - 1, H + 2, Math.max(2, br - 1), t.fg);
    bx += 9 + rnd() * 18;
  }
}

/* ------------------------------------------------------------------- pet */

var pet = {
  x: 20, dir: 1, state: 'walk', timer: 2000, frame: 0, frameTick: 0, hop: 0
};
var ball = null;
var flecks = [];
var hearts = [];

function seedFlecks() {
  var t = THEMES[theme];
  flecks = [];
  for (var i = 0; i < t.flecks; i++) {
    flecks.push({
      x: Math.random() * W,
      y: Math.random() * GROUND,
      vx: (Math.random() - 0.3) * t.drift,
      vy: t.fall * (0.6 + Math.random() * 0.8),
      c: t.fleck[Math.floor(Math.random() * t.fleck.length)],
      phase: Math.random() * 6.28
    });
  }
}

function drawBody(g, sp, x, y, dir, squash) {
  var rows = BODIES[sp] || BODIES.cat;
  var pal = PALETTES[sp] || PALETTES.cat;
  g.save();
  g.translate(Math.round(x), Math.round(y));
  if (dir < 0) { g.scale(-1, 1); g.translate(-16, 0); }
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    for (var c = 0; c < row.length; c++) {
      var ch = row.charAt(c);
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || pal.x;
      g.fillRect(c, r + squash, 1, 1);
    }
  }
  g.restore();
}

function drawLegs(g, sp, x, y, dir, phase, moving) {
  if (sp === 'ghost') return;
  var pal = PALETTES[sp] || PALETTES.cat;
  g.fillStyle = pal.d;
  var swing = moving ? [0, 1, 0, -1][phase] : 0;
  var pairs = [[3, swing], [5, -swing], [10, -swing], [12, swing]];
  for (var i = 0; i < pairs.length; i++) {
    var lx = dir < 0 ? 15 - pairs[i][0] - 1 : pairs[i][0];
    g.fillRect(Math.round(x) + lx, Math.round(y) + 8, 2, 3 - Math.abs(pairs[i][1]));
  }
}

function drawTail(g, sp, x, y, dir, t) {
  if (sp === 'ghost') return;
  var pal = PALETTES[sp] || PALETTES.cat;
  var wag = Math.round(Math.sin(t / 260) * 1.6);
  var bx = Math.round(x) + (dir < 0 ? 14 : 1);
  g.fillStyle = pal.x;
  if (sp === 'fox') {
    g.fillRect(bx - (dir < 0 ? -1 : 1), y + 4 + wag, 3, 4);
    g.fillStyle = pal.l;
    g.fillRect(bx - (dir < 0 ? -1 : 1), y + 3 + wag, 3, 1);
  } else {
    g.fillRect(bx, y + 4, 1, 2);
    g.fillRect(bx - (dir < 0 ? -1 : 1), y + 2 + wag, 1, 2);
  }
}

function drawZs(g, x, y, t) {
  g.fillStyle = '#ffffff';
  for (var i = 0; i < 2; i++) {
    var p = ((t / 900) + i * 0.5) % 1;
    var zx = Math.round(x + 14 + p * 5);
    var zy = Math.round(y - p * 9);
    g.globalAlpha = 1 - p;
    g.fillRect(zx, zy, 3, 1);
    g.fillRect(zx + 1, zy + 1, 1, 1);
    g.fillRect(zx, zy + 2, 3, 1);
  }
  g.globalAlpha = 1;
}

var HEART = ['.x.x.', 'xxxxx', 'xxxxx', '.xxx.', '..x..'];

function drawHeart(g, x, y, alpha) {
  g.globalAlpha = alpha;
  g.fillStyle = '#f0607a';
  for (var r = 0; r < HEART.length; r++) {
    for (var c = 0; c < HEART[r].length; c++) {
      if (HEART[r].charAt(c) === 'x') g.fillRect(Math.round(x) + c, Math.round(y) + r, 1, 1);
    }
  }
  g.globalAlpha = 1;
}

/* ------------------------------------------------------------------ loop */

var last = performance.now();
var clock = 0;
var idleSince = performance.now();

function petTop() {
  return GROUND - 11;
}

function step(dt) {
  clock += dt;
  var t = THEMES[theme];

  for (var i = 0; i < flecks.length; i++) {
    var f = flecks[i];
    f.x += f.vx + Math.sin((clock + f.phase * 900) / 700) * 0.12;
    f.y += f.vy;
    if (f.y > GROUND + 2 || f.y < -2) { f.y = f.vy > 0 ? -2 : GROUND; f.x = Math.random() * W; }
    if (f.x < -2) f.x = W + 1; else if (f.x > W + 2) f.x = -1;
  }

  if (ball) {
    ball.vy += 0.028 * dt / 16;
    ball.x += ball.vx * dt / 16;
    ball.y += ball.vy * dt / 16;
    if (ball.y > GROUND - 2) {
      ball.y = GROUND - 2;
      ball.vy *= -0.45;
      ball.vx *= 0.7;
      if (Math.abs(ball.vy) < 0.25) ball.vy = 0;
    }
    if (ball.x < 2) { ball.x = 2; ball.vx *= -0.6; }
    if (ball.x > W - 2) { ball.x = W - 2; ball.vx *= -0.6; }
  }

  var speed = 0.34 * dt / 16;

  if (ball && pet.state !== 'happy') {
    pet.state = 'chase';
    pet.dir = ball.x > pet.x + 8 ? 1 : -1;
    pet.x += speed * 1.7 * pet.dir;
    if (Math.abs(ball.x - (pet.x + 8)) < 5) {
      ball = null;
      pet.state = 'happy';
      pet.timer = 1100;
      vscodeApi.postMessage({ type: 'caught' });
      for (var h = 0; h < 3; h++) hearts.push({ x: pet.x + 4 + h * 3, y: petTop(), life: 900 + h * 120, max: 900 + h * 120 });
    }
  } else {
    pet.timer -= dt;
    if (pet.timer <= 0) {
      if (pet.state === 'happy') { pet.state = 'walk'; pet.timer = 3000; }
      else if (pet.state === 'walk') {
        pet.state = Math.random() > 0.55 ? 'sit' : 'walk';
        pet.dir = Math.random() > 0.5 ? 1 : -1;
        pet.timer = 1800 + Math.random() * 4000;
      } else {
        pet.state = 'walk';
        pet.timer = 2500 + Math.random() * 4000;
      }
    }
    if (clock - idleSince > 60000 && pet.state !== 'happy') pet.state = 'sleep';
    if (pet.state === 'walk') {
      pet.x += speed * pet.dir;
      if (pet.x < 1) { pet.x = 1; pet.dir = 1; }
      if (pet.x > W - 17) { pet.x = W - 17; pet.dir = -1; }
    }
  }

  pet.frameTick += dt;
  if (pet.frameTick > 130) { pet.frameTick = 0; pet.frame = (pet.frame + 1) % 4; }

  for (var k = hearts.length - 1; k >= 0; k--) {
    hearts[k].life -= dt;
    hearts[k].y -= 0.03 * dt;
    if (hearts[k].life <= 0) hearts.splice(k, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(bg, 0, 0);

  for (var i = 0; i < flecks.length; i++) {
    ctx.fillStyle = flecks[i].c;
    ctx.fillRect(Math.round(flecks[i].x), Math.round(flecks[i].y), 1, 1);
  }

  var y = petTop();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = THEMES[theme].fg;
  ctx.fillRect(Math.round(pet.x) + 3, GROUND, species === 'ghost' ? 8 : 11, 1);
  ctx.globalAlpha = 1;

  var moving = pet.state === 'walk' || pet.state === 'chase';
  var squash = 0;
  if (pet.state === 'sit' || pet.state === 'sleep') squash = 2;
  if (species === 'ghost') squash = Math.round(Math.sin(clock / 420) * 1.5) - 1;
  if (pet.state === 'happy') squash = Math.abs(Math.sin(clock / 90)) * -3;

  drawTail(ctx, species, pet.x, y + squash, pet.dir, clock);
  drawLegs(ctx, species, pet.x, y + squash, pet.dir, pet.frame, moving);
  drawBody(ctx, species, pet.x, y, pet.dir, squash);

  if (pet.state === 'sleep') drawZs(ctx, pet.x, y, clock);

  if (ball) {
    disc(ctx, ball.x, ball.y, 2, '#f0f0f0');
    ctx.fillStyle = '#d1435b';
    ctx.fillRect(Math.round(ball.x) - 1, Math.round(ball.y) - 1, 2, 1);
  }

  for (var k = 0; k < hearts.length; k++) {
    drawHeart(ctx, hearts[k].x, hearts[k].y - 8, Math.max(0, hearts[k].life / hearts[k].max));
  }
}

function frame(now) {
  var dt = Math.min(60, now - last);
  last = now;
  step(dt);
  draw();
  requestAnimationFrame(frame);
}

/* -------------------------------------------------------------- plumbing */

function resize() {
  var cssW = Math.max(90, stage.clientWidth || 240);
  W = Math.max(64, Math.round(cssW / SCALE));
  GROUND = H - 13;
  canvas.width = W;
  canvas.height = H;
  canvas.style.height = Math.round(H * (cssW / W)) + 'px';
  if (pet.x > W - 17) pet.x = W - 17;
  buildBackground();
  seedFlecks();
}

function throwBall(x) {
  ball = {
    x: Math.max(3, Math.min(W - 3, x)),
    y: 4,
    vx: (pet.x + 8 - x) * 0.012,
    vy: 0.2
  };
  idleSince = clock;
  if (pet.state === 'sleep') pet.state = 'walk';
}

stage.addEventListener('click', function (e) {
  var rect = canvas.getBoundingClientRect();
  var x = (e.clientX - rect.left) * (W / rect.width);
  var y = (e.clientY - rect.top) * (H / rect.height);
  idleSince = clock;
  if (pet.state === 'sleep') { pet.state = 'walk'; pet.timer = 2000; }

  if (x > pet.x - 2 && x < pet.x + 18 && y > petTop() - 3) {
    pet.state = 'happy';
    pet.timer = 900;
    hearts.push({ x: pet.x + 6, y: petTop(), life: 900, max: 900 });
    vscodeApi.postMessage({ type: 'petted' });
  } else {
    throwBall(x);
  }
});

window.addEventListener('message', function (e) {
  var msg = e.data;
  if (!msg) return;
  if (msg.type === 'config') {
    var rebuild = msg.theme !== theme;
    species = msg.species;
    theme = msg.theme;
    if (rebuild) { buildBackground(); seedFlecks(); }
  } else if (msg.type === 'ball') {
    throwBall(pet.x > W / 2 ? 6 : W - 6);
  }
});

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);
`;

module.exports = { PetViewProvider, SPECIES, THEMES };
