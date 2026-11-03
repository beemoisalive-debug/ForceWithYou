// ═════════════════════════════════════════════════════════════
//  NoC BILLIARDS — 8볼 샌드박스
//  뒤로 드래그해서 큐를 당긴 뒤 놓으면 샷!
// ═════════════════════════════════════════════════════════════

const SUBSTEPS = 3;
const HEAD_SPOT = { x: TABLE.x + TABLE.w * 0.26, y: TABLE.y + TABLE.h / 2 };

let balls = [];
let cue;
let potted = [];
let pockets = [];
let feltLayer;

let aiming = false;
let aimPower = 0;
let cueRespawn = 0;
let message = '';
let messageTimer = 0;

// ─────────────────────────────────────────────────────────────
function setup() {
  createCanvas(900, 540);
  angleMode(RADIANS);
  textFont('Helvetica Neue, Arial, sans-serif');

  buildFelt();
  buildPockets();
  newGame();
}

function buildPockets() {
  const { x, y, w, h } = TABLE;
  pockets = [
    { x: x,             y: y     }, // 좌상
    { x: x + w / 2,     y: y     }, // 상단 중앙
    { x: x + w,         y: y     }, // 우상
    { x: x,             y: y + h }, // 좌하
    { x: x + w / 2,     y: y + h }, // 하단 중앙
    { x: x + w,         y: y + h }, // 우하
  ];
}

function buildFelt() {
  feltLayer = createGraphics(TABLE.w, TABLE.h);
  feltLayer.noStroke();
  feltLayer.background(24, 94, 61);

  const ctx = feltLayer.drawingContext;

  // 중앙 조명 느낌
  const g = ctx.createRadialGradient(
    TABLE.w / 2, TABLE.h / 2, 30,
    TABLE.w / 2, TABLE.h / 2, TABLE.w * 0.65
  );
  g.addColorStop(0, 'rgba(150, 215, 170, 0.20)');
  g.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TABLE.w, TABLE.h);

  // 펠트 질감
  for (let i = 0; i < 8000; i++) {
    const bright = random() > 0.5;
    feltLayer.fill(255, 255, 255, bright ? random(5, 16) : 0);
    feltLayer.circle(random(TABLE.w), random(TABLE.h), random(0.6, 1.5));
  }
  for (let i = 0; i < 3000; i++) {
    feltLayer.fill(0, 0, 0, random(5, 18));
    feltLayer.circle(random(TABLE.w), random(TABLE.h), random(0.6, 1.8));
  }
}

// ─────────────────────────────────────────────────────────────
//  게임 초기화 / 랙
// ─────────────────────────────────────────────────────────────
function newGame() {
  balls = [];
  potted = [];
  aiming = false;
  aimPower = 0;
  cueRespawn = 0;
  message = '공을 뒤로 당겨서 조준하세요';
  messageTimer = 150;

  cue = new Ball(HEAD_SPOT.x, HEAD_SPOT.y, 0);
  balls.push(cue);

  rackBalls();
}

function rackBalls() {
  // 8볼 랙 (8번은 3열 중앙, 뒷줄 양 끝은 솔리드/스트라이프)
  const rows = [
    [1],
    [9, 2],
    [10, 8, 3],
    [11, 12, 4, 13],
    [5, 14, 6, 15, 7],
  ];

  const gap = BALL_R * 2 + 0.6;
  const rowGap = gap * Math.sqrt(3) / 2;
  const apexX = TABLE.x + TABLE.w * 0.72;
  const cy = TABLE.y + TABLE.h / 2;

  rows.forEach((row, rowIndex) => {
    const x = apexX + rowIndex * rowGap;
    row.forEach((number, i) => {
      const y = cy + (i - (row.length - 1) / 2) * gap;
      balls.push(new Ball(x, y, number));
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  메인 루프
// ─────────────────────────────────────────────────────────────
function draw() {
  background(17, 19, 23);

  drawTable();
  simulate();
  drawBalls();
  drawAimLine();
  drawHud();
  drawMessage();

  if (cueRespawn > 0) cueRespawn--;
  if (messageTimer > 0) messageTimer--;
}

function simulate() {
  for (let step = 0; step < SUBSTEPS; step++) {
    for (const b of balls) b.update();

    // 공끼리 충돌
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        resolveBallCollision(balls[i], balls[j]);
      }
    }

    // 포켓 or 쿠션
    for (const b of balls) {
      if (b.pocketIndex(pockets) >= 0) {
        b._potted = true;
      } else {
        b.collideWalls();
      }
    }

    // 빠진 공 정리 (큐볼은 헤드 스팟으로 복귀)
    const survivors = [];
    for (const b of balls) {
      if (!b._potted) {
        survivors.push(b);
        continue;
      }
      b._potted = false;

      if (b === cue) {
        cueRespawn = 30;
        message = '큐볼이 포켓에 들어갔습니다!';
        messageTimer = 110;
        b.pos.set(HEAD_SPOT.x, HEAD_SPOT.y);
        b.vel.set(0, 0);
        survivors.push(b);
      } else {
        potted.push(b.number);
        if (potted.length === 15) {
          message = '모든 공을 넣었습니다! R로 리셋';
          messageTimer = 240;
        }
      }
    }
    balls = survivors;
  }
}

// 동일 질량 탄성 충돌
function resolveBallCollision(a, b) {
  const delta = p5.Vector.sub(b.pos, a.pos);
  let d = delta.mag();
  const minDist = a.r + b.r;

  if (d === 0) {
    delta.set(random(-1, 1), random(-1, 1));
    d = delta.mag();
  }
  if (d >= minDist) return;

  const normal = delta.copy().div(d);

  // 위치 보정
  const overlap = minDist - d;
  a.pos.add(p5.Vector.mult(normal, -overlap / 2));
  b.pos.add(p5.Vector.mult(normal, overlap / 2));

  // 법선 방향 상대 속도
  const relative = p5.Vector.sub(b.vel, a.vel);
  const speedAlongNormal = relative.dot(normal);
  if (speedAlongNormal > 0) return;

  const impulse = -(1 + BALL_BOUNCE) * speedAlongNormal / 2;
  a.vel.add(p5.Vector.mult(normal, -impulse));
  b.vel.add(p5.Vector.mult(normal, impulse));
}

function allStopped() {
  return balls.every((b) => b.vel.mag() < 0.05);
}

// ─────────────────────────────────────────────────────────────
//  테이블 그리기
// ─────────────────────────────────────────────────────────────
function drawTable() {
  // 테이블 그림자
  noStroke();
  fill(0, 0, 0, 110);
  rect(34, 40, 840, 448, 28);

  // 나무 프레임
  fill(70, 40, 24);
  rect(26, 26, 848, 448, 26);
  fill(124, 76, 43);
  rect(32, 31, 836, 438, 22);
  fill(54, 30, 18);
  rect(41, 39, 818, 422, 15);

  // 펠트
  image(feltLayer, TABLE.x, TABLE.y);

  // 펠트 안쪽 그림자
  noFill();
  stroke(0, 0, 0, 90);
  strokeWeight(7);
  rect(TABLE.x, TABLE.y, TABLE.w, TABLE.h, 5);
  stroke(255, 255, 255, 12);
  strokeWeight(1.5);
  rect(TABLE.x + 3, TABLE.y + 3, TABLE.w - 6, TABLE.h - 6, 4);

  // 테이블 로고
  noStroke();
  fill(255, 255, 255, 12);
  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(46);
  text('NoC BILLIARDS', TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2);
  textStyle(NORMAL);

  drawSights();

  for (const p of pockets) drawPocket(p);
}

function drawSights() {
  noStroke();
  fill(226, 214, 182, 190);

  const midX = TABLE.x + TABLE.w / 2;
  for (let i = 1; i <= 7; i++) {
    const x = TABLE.x + (TABLE.w * i) / 8;
    if (Math.abs(x - midX) < 1) continue; // 사이드 포켓 자리
    circle(x, 38, 5);
    circle(x, 462, 5);
  }

  for (let i = 1; i <= 3; i++) {
    const y = TABLE.y + (TABLE.h * i) / 4;
    circle(36, y, 5);
    circle(864, y, 5);
  }
}

function drawPocket(p) {
  const ctx = drawingContext;

  noStroke();
  fill(0, 0, 0, 150);
  circle(p.x, p.y, POCKET_R * 2 + 12);

  const g = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, POCKET_R + 4);
  g.addColorStop(0, '#000000');
  g.addColorStop(0.55, '#060907');
  g.addColorStop(1, '#1a1008');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(p.x, p.y, POCKET_R + 4, 0, Math.PI * 2);
  ctx.fill();

  noFill();
  stroke(198, 158, 86, 150);
  strokeWeight(2.5);
  circle(p.x, p.y, POCKET_R * 2 + 9);
}

// ─────────────────────────────────────────────────────────────
//  공 그리기
// ─────────────────────────────────────────────────────────────
function drawBalls() {
  // 헤드 스팟 표시
  if (potted.length === 0 && allStopped()) {
    noStroke();
    fill(255, 255, 255, 35);
    circle(HEAD_SPOT.x, HEAD_SPOT.y, 6);
  }

  for (const b of balls) {
    // 큐볼 리스폰 중 깜빡임
    if (b === cue && cueRespawn > 0 && Math.floor(frameCount / 4) % 2 === 0) continue;
    b.show();
  }
}

// ─────────────────────────────────────────────────────────────
//  조준 / 큐대 / 궤적
// ─────────────────────────────────────────────────────────────
function mousePressed() {
  // p5 2.x는 mouseButton이 객체, 1.x는 상수
  const isLeft = typeof mouseButton === 'object' ? mouseButton.left : mouseButton === LEFT;
  if (!isLeft) return;
  if (!allStopped() || cueRespawn > 0) return;
  aiming = true;
}

function mouseReleased() {
  if (!aiming) return;
  aiming = false;
  aimPower = 0;

  if (!allStopped() || cueRespawn > 0) return;

  const dir = createVector(cue.pos.x - mouseX, cue.pos.y - mouseY);
  const pull = dir.mag();
  if (pull < 18) return;

  const power = constrain(map(pull, 18, 240, 0.08, 1), 0, 1);
  dir.normalize().mult(4 + power * 23);
  cue.vel.set(dir.x, dir.y);
  messageTimer = 0;
}

function drawAimLine() {
  if (!aiming || cueRespawn > 0 || !allStopped()) return;

  const mouse = createVector(mouseX, mouseY);
  const dir = p5.Vector.sub(cue.pos, mouse);
  const pull = dir.mag();
  if (pull < 6) return;

  dir.normalize();
  aimPower = constrain(map(pull, 18, 240, 0, 1), 0, 1);

  // 예상 궤적 (공에 먼저 맞으면 그 지점에서 멈춤, 아니면 쿠션 1회 반사)
  const ctx = drawingContext;
  const start = p5.Vector.add(cue.pos, p5.Vector.mult(dir, BALL_R + 1));
  const cushion = rayHit(start, dir, BALL_R);
  const toCushion = p5.Vector.dist(cue.pos, cushion.point);
  const hitBall = rayBallHit(cue.pos, dir);
  const aimAlpha = 0.28 + aimPower * 0.4;

  ctx.save();
  ctx.setLineDash([9, 9]);
  ctx.lineWidth = 2;

  if (hitBall && hitBall.t < toCushion) {
    const contact = p5.Vector.add(cue.pos, p5.Vector.mult(dir, hitBall.t));

    ctx.strokeStyle = `rgba(255,255,255,${aimAlpha})`;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(contact.x, contact.y);
    ctx.stroke();

    // 고스트 볼 (맞을 위치)
    ctx.setLineDash([4, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(contact.x, contact.y, BALL_R, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = `rgba(255,255,255,${aimAlpha})`;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(cushion.point.x, cushion.point.y);
    ctx.stroke();

    if (cushion.normal) {
      const bounced = p5.Vector.sub(dir, p5.Vector.mult(cushion.normal, 2 * dir.dot(cushion.normal)));
      const second = rayHit(p5.Vector.add(cushion.point, p5.Vector.mult(bounced, 0.5)), bounced, BALL_R);
      ctx.strokeStyle = `rgba(255,255,255,${0.10 + aimPower * 0.18})`;
      ctx.beginPath();
      ctx.moveTo(cushion.point.x, cushion.point.y);
      ctx.lineTo(second.point.x, second.point.y);
      ctx.stroke();
    }
  }
  ctx.restore();

  drawCueStick(dir, pull);
}

// 광선 → 공 충돌 (가장 가까운 공)
function rayBallHit(origin, dir) {
  let best = null;
  const contactDist = BALL_R * 2; // 공 두 개가 닿는 중심 거리

  for (const b of balls) {
    if (b === cue) continue;

    const to = p5.Vector.sub(b.pos, origin);
    const proj = to.dot(dir);
    if (proj <= 0) continue;

    const perpSq = to.magSq() - proj * proj;
    const rSq = contactDist * contactDist;
    if (perpSq > rSq) continue;

    const t = proj - Math.sqrt(rSq - perpSq);
    if (t < 0) continue;
    if (!best || t < best.t) best = { t, ball: b };
  }
  return best;
}

// 광선 → 쿠션 충돌 지점
function rayHit(origin, dir, radius) {
  const left = TABLE.x + radius;
  const right = TABLE.x + TABLE.w - radius;
  const top = TABLE.y + radius;
  const bottom = TABLE.y + TABLE.h - radius;

  let t = Infinity;
  let axis = '';

  if (dir.x < 0) {
    const tt = (left - origin.x) / dir.x;
    if (tt > 0 && tt < t) { t = tt; axis = 'x'; }
  } else if (dir.x > 0) {
    const tt = (right - origin.x) / dir.x;
    if (tt > 0 && tt < t) { t = tt; axis = 'x'; }
  }

  if (dir.y < 0) {
    const tt = (top - origin.y) / dir.y;
    if (tt > 0 && tt < t) { t = tt; axis = 'y'; }
  } else if (dir.y > 0) {
    const tt = (bottom - origin.y) / dir.y;
    if (tt > 0 && tt < t) { t = tt; axis = 'y'; }
  }

  if (!isFinite(t)) {
    return { point: origin.copy(), normal: null };
  }

  const point = p5.Vector.add(origin, p5.Vector.mult(dir, t));
  let normal = null;
  if (axis === 'x') {
    normal = createVector(dir.x > 0 ? -1 : 1, 0);
  } else if (axis === 'y') {
    normal = createVector(0, dir.y > 0 ? -1 : 1);
  }
  return { point, normal };
}

function drawCueStick(dir, pull) {
  const angle = dir.heading();
  const gap = BALL_R + 3 + map(constrain(pull, 18, 240), 18, 240, 0, 58);

  push();
  translate(cue.pos.x, cue.pos.y);
  rotate(angle);

  noStroke();

  // 큐대 그림자
  fill(0, 0, 0, 45);
  quad(-gap + 2, 4, -gap - 300, 6, -gap - 300, 10, -gap + 2, 8);

  // 샤프트
  fill(216, 176, 120);
  quad(-gap, -3.4, -gap - 300, -1.2, -gap - 300, 1.2, -gap, 3.4);

  // 버트 (뒷부분)
  fill(88, 50, 30);
  quad(-gap - 300, -1.2, -gap - 364, -1.7, -gap - 364, 1.7, -gap - 300, 1.2);
  fill(232, 224, 208);
  rect(-gap - 306, -1.5, 6, 3);

  // 팁
  fill(72, 132, 212);
  rect(-gap - 6, -3.4, 6, 6.8, 1);

  pop();
}

// ─────────────────────────────────────────────────────────────
//  HUD
// ─────────────────────────────────────────────────────────────
function drawHud() {
  // 파워 게이지
  noStroke();
  fill(255, 255, 255, 22);
  rect(50, 502, 210, 16, 8);

  const p = aiming ? aimPower : 0;
  if (p > 0.01) {
    let barColor;
    if (p < 0.5) barColor = lerpColor(color('#3ddc84'), color('#ffd23f'), p * 2);
    else barColor = lerpColor(color('#ffd23f'), color('#ff5252'), (p - 0.5) * 2);
    fill(barColor);
    rect(50, 502, max(16, 210 * p), 16, 8);
  }

  fill(148, 155, 168);
  textAlign(LEFT, CENTER);
  textSize(11);
  textStyle(BOLD);
  text('POWER', 50, 490);
  textStyle(NORMAL);

  // 안내 문구
  if (allStopped() && cueRespawn === 0) {
    textAlign(CENTER, CENTER);
    fill(190, 196, 208);
    textSize(12);
    text('공 뒤로 드래그 → 놓으면 샷!', 430, 502);
    fill(120, 126, 138);
    textSize(11);
    text('R : 리셋', 430, 518);
  } else {
    textAlign(CENTER, CENTER);
    fill(110, 116, 128);
    textSize(12);
    text('...', 430, 510);
  }

  // 포켓에 들어간 공
  fill(148, 155, 168);
  textAlign(RIGHT, CENTER);
  textSize(11);
  textStyle(BOLD);
  text('POTTED', 850, 490);
  textStyle(NORMAL);

  const miniR = 7;
  const step = miniR * 2 + 4;
  for (let i = 0; i < potted.length; i++) {
    const x = 850 - miniR - i * step;
    drawPoolBall(x, 510, miniR, potted[i]);
  }
}

function drawMessage() {
  if (messageTimer <= 0 || !message) return;

  const alpha = Math.min(1, messageTimer / 40) * 255;

  textAlign(CENTER, CENTER);
  textStyle(BOLD);
  textSize(16);

  // 그림자
  noStroke();
  fill(0, 0, 0, alpha * 0.6);
  text(message, TABLE.x + TABLE.w / 2 + 1, TABLE.y + 31);

  fill(255, 255, 255, alpha);
  text(message, TABLE.x + TABLE.w / 2, TABLE.y + 30);
  textStyle(NORMAL);
}

// ─────────────────────────────────────────────────────────────
function keyPressed() {
  if (key === 'r' || key === 'R') newGame();
}
