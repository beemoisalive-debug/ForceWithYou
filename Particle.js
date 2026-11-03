class Particle {
  constructor() {
    this.pos = createVector(width/2, height/3);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);

    this.c = color(0);
    this.w = 50;
  }

  addForce(aForce) {
    this.acc.add(aForce);
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);

    this.acc.set(0, 0);
    this.checkEdge();
  }


  checkEdge() {
    if ((this.pos.y+this.w/2) > height) {
      this.pos.y = height-this.w/2;
      this.vel.y = this.vel.y * -1;
    }
    
    if (this.pos.x > width) {
      this.pos.x = 0;
    }
  }


  show() {
    fill(this.c);
    circle(this.pos.x, this.pos.y, this.w);
  }
}
