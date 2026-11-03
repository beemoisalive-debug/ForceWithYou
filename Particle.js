// ─────────────────────────────────────────────────────────────
//  당구 테이블 설정
// ─────────────────────────────────────────────────────────────
const TABLE = { x: 50, y: 50, w: 800, h: 400 };

const BALL_R = 11.5;        // 공 반지름
const POCKET_R = 22;        // 포켓 구멍 반지름
const FRICTION = 0.9955;    // 구름 마찰 (매 substep)
const WALL_BOUNCE = 0.86;   // 쿠션 반발 계수
const BALL_BOUNCE = 0.96;   // 공끼리 반발 계수

// 공별 색 / 줄무늬 여부
const BALL_STYLES = {
  0:  { col: '#f6f3e8', stripe: false }, // 큐볼
  1:  { col: '#f0c419', stripe: false },
  2:  { col: '#1f5fd0', stripe: false },
  3:  { col: '#d8322f', stripe: false },
  4:  { col: '#7b3fa0', stripe: false },
  5:  { col: '#e8791b', stripe: false },
  6:  { col: '#1f8a4c', stripe: false },
  7:  { col: '#8c2332', stripe: false },
  8:  { col: '#17171a', stripe: false },
  9:  { col: '#f0c419', stripe: true },
  10: { col: '#1f5fd0', stripe: true },
  11: { col: '#d8322f', stripe: true },
  12: { col: '#7b3fa0', stripe: true },
  13: { col: '#e8791b', stripe: true },
  14: { col: '#1f8a4c', stripe: true },
  15: { col: '#8c2332', stripe: true },
};

class Ball {
  constructor(x, y, number) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.number = number;
    this.r = BALL_R;

    const style = BALL_STYLES[number];
    this.col = style.col;
    this.stripe = style.stripe;
  }

  update() {
    this.pos.add(this.vel);

    // 마찰
    this.vel.mult(FRICTION);
    if (this.vel.mag() < 0.06) this.vel.set(0, 0);
  }

  // 쿠션(테이블 벽) 반사
  collideWalls() {
    const left = TABLE.x + this.r;
    const right = TABLE.x + TABLE.w - this.r;
    const top = TABLE.y + this.r;
    const bottom = TABLE.y + TABLE.h - this.r;

    if (this.pos.x < left) {
      this.pos.x = left;
      this.vel.x = Math.abs(this.vel.x) * WALL_BOUNCE;
    } else if (this.pos.x > right) {
      this.pos.x = right;
      this.vel.x = -Math.abs(this.vel.x) * WALL_BOUNCE;
    }

    if (this.pos.y < top) {
      this.pos.y = top;
      this.vel.y = Math.abs(this.vel.y) * WALL_BOUNCE;
    } else if (this.pos.y > bottom) {
      this.pos.y = bottom;
      this.vel.y = -Math.abs(this.vel.y) * WALL_BOUNCE;
    }
  }

  // 포켓에 들어갔는지 확인 (인덱스 반환, 아니면 -1)
  pocketIndex(pockets) {
    for (let i = 0; i < pockets.length; i++) {
      const p = pockets[i];
      if (dist(this.pos.x, this.pos.y, p.x, p.y) < POCKET_R * 0.82) {
        return i;
      }
    }
    return -1;
  }

  show() {
    drawPoolBall(this.pos.x, this.pos.y, this.r, this.number);
  }
}

// ─────────────────────────────────────────────────────────────
//  공 그리기 (하이라이트 + 줄무늬 + 번호)
// ─────────────────────────────────────────────────────────────
function drawPoolBall(x, y, r, number) {
  const style = BALL_STYLES[number];
  const ctx = drawingContext;

  // 바닥 그림자
  noStroke();
  fill(0, 0, 0, 70);
  ellipse(x + r * 0.18, y + r * 0.28, r * 2.02, r * 1.85);

  // 공 본체 (원형 클립)
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();

  noStroke();
  if (number === 0) {
    fill(style.col);
    circle(x, y, r * 2);
  } else if (style.stripe) {
    fill(247, 244, 234);
    circle(x, y, r * 2);
    fill(style.col);
    rect(x - r, y - r * 0.40, r * 2, r * 0.80);
  } else {
    fill(style.col);
    circle(x, y, r * 2);
  }

  // 광택 + 입체감
  const g = ctx.createRadialGradient(
    x - r * 0.35, y - r * 0.42, r * 0.05,
    x, y, r * 1.12
  );
  g.addColorStop(0.00, 'rgba(255,255,255,0.65)');
  g.addColorStop(0.30, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.70, 'rgba(0,0,0,0.06)');
  g.addColorStop(1.00, 'rgba(0,0,0,0.50)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // 테두리
  noFill();
  stroke(0, 0, 0, 70);
  strokeWeight(1);
  circle(x, y, r * 2);

  // 번호 원
  if (number > 0) {
    noStroke();
    fill(248, 246, 240);
    circle(x, y, r * 1.06);

    fill(25, 25, 28);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    textSize(number >= 10 ? r * 0.62 : r * 0.74);
    text(number, x, y + r * 0.04);
    textStyle(NORMAL);
  }
}
