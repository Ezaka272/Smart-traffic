const DIRECTIONS = ["north", "east", "south", "west"];
const DIRECTION_LABEL = {
  north: "Nord",
  east: "Est",
  south: "Sud",
  west: "Ouest",
};

const WORLD = 1000;
const CX = WORLD / 2;
const CY = WORLD / 2;
const RING_R = 168; 
const ROAD_HALF = 78; 
const OFFSET_DEG = 18; 
const LANE_OFF = RING_R * Math.sin((OFFSET_DEG * Math.PI) / 180);
const ENTRY_DIST = RING_R * Math.cos((OFFSET_DEG * Math.PI) / 180);
const SPAWN_DIST = WORLD / 2 + 60;
const STOP_DIST = ENTRY_DIST + 14; 
const CAR_GAP = 34; 
const RING_GAP_DEG = 26; 
const RING_FOLLOW_DEG = 13; 

const BASE_ANGLE = {
  east: 0,
  south: 90,
  west: 180,
  north: 270,
};

const rad = (deg) => (deg * Math.PI) / 180;
const norm360 = (deg) => ((deg % 360) + 360) % 360;

function axis(dir) {
  const a = rad(BASE_ANGLE[dir]);
  return { x: Math.cos(a), y: Math.sin(a) };
}

function inboundPoint(dir, dist) {
  const u = axis(dir);
  const right = { x: u.y, y: -u.x };
  return { x: CX + u.x * dist + right.x * LANE_OFF, y: CY + u.y * dist + right.y * LANE_OFF };
}

function outboundPoint(dir, dist) {
  const u = axis(dir);
  const left = { x: -u.y, y: u.x };
  return { x: CX + u.x * dist + left.x * LANE_OFF, y: CY + u.y * dist + left.y * LANE_OFF };
}

function ringPoint(angleDeg, r = RING_R) {
  const a = rad(angleDeg);
  return { x: CX + Math.cos(a) * r, y: CY + Math.sin(a) * r };
}

const entryAngle = (dir) => norm360(BASE_ANGLE[dir] - OFFSET_DEG);
const exitAngle = (dir) => norm360(BASE_ANGLE[dir] + OFFSET_DEG);

const DEFAULT_CONFIG = {
  spawnRate: 14,
  threshold: 8,
  baseGreen: 8,
  amber: 2.5,
  speedFactor: 1,
};

const PALETTE = [
  "oklch(0.82 0.17 82)",
  "oklch(0.72 0.15 195)",
  "oklch(0.75 0.19 148)",
  "oklch(0.68 0.2 25)",
  "oklch(0.78 0.13 300)",
  "oklch(0.88 0.05 250)",
];

const GROUP = {
  north: "ns",
  south: "ns",
  east: "ew",
  west: "ew",
};

class TrafficEngine {
  constructor(config = DEFAULT_CONFIG) {
    this.config = { ...config };
    this.cars = [];
    this.nextId = 1;
    this.spawnAcc = { north: 0, east: 0, south: 0, west: 0 };
    this.group = "ns";
    this.phase = "green";
    this.greenDuration = this.config.baseGreen;
    this.phaseTimer = this.config.baseGreen;
    this.elapsed = 0;
    this.passed = 0;
    this.waitSum = 0;
    this.waitSamples = 0;
    this.maxWait = 0;
    this.aiPriority = null;
    this.aiBoost = 0;
  }

  reset() {
    this.cars = [];
    this.nextId = 1;
    this.spawnAcc = { north: 0, east: 0, south: 0, west: 0 };
    this.group = "ns";
    this.phase = "green";
    this.greenDuration = this.config.baseGreen;
    this.phaseTimer = this.config.baseGreen;
    this.elapsed = 0;
    this.passed = 0;
    this.waitSum = 0;
    this.waitSamples = 0;
    this.maxWait = 0;
    this.aiPriority = null;
    this.aiBoost = 0;
  }

  applyDecision(priority, greenDuration) {
    this.aiPriority = priority;
    this.group = GROUP[priority];
    this.phase = "green";
    this.greenDuration = Math.max(5, Math.min(60, greenDuration));
    this.phaseTimer = this.greenDuration;
    this.aiBoost = 1;
  }

  lightFor(dir) {
    if (GROUP[dir] !== this.group) return "red";
    return this.phase === "green" ? "green" : "amber";
  }

  queueCount(dir) {
    return this.cars.filter((c) => c.from === dir && c.phase === "approach").length;
  }

  counts() {
    return {
      north: this.queueCount("north"),
      east: this.queueCount("east"),
      south: this.queueCount("south"),
      west: this.queueCount("west"),
    };
  }

  congested() {
    const c = this.counts();
    return DIRECTIONS.filter((d) => c[d] >= this.config.threshold);
  }

  spawnCar(from, to) {
    const others = DIRECTIONS.filter((d) => d !== from);
    const dest = to ?? (Math.random() < 0.08 ? from : others[Math.floor(Math.random() * 3)]);
    const queue = this.cars.filter((c) => c.from === from && c.phase === "approach");
    const furthest = queue.reduce((m, c) => Math.max(m, c.dist), 0);
    const dist = Math.max(SPAWN_DIST, furthest + CAR_GAP);
    if (dist > SPAWN_DIST + 700) return;

    this.cars.push({
      id: this.nextId++,
      from,
      to: dest,
      phase: "approach",
      dist,
      angle: entryAngle(from),
      arcLeft: 0,
      speed: 0,
      maxSpeed: 92 + Math.random() * 26,
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      waited: 0,
      blinking: false,
    });
  }

  updateLights(dt) {
    this.phaseTimer -= dt;
    if (this.phaseTimer > 0) return;
    if (this.phase === "green") {
      this.phase = "amber";
      this.phaseTimer = this.config.amber;
      return;
    }
    this.phase = "green";
    this.group = this.group === "ns" ? "ew" : "ns";
    if (this.aiBoost > 0) {
      this.aiBoost = 0;
      this.greenDuration = this.config.baseGreen;
      this.aiPriority = null;
    }
    const counts = this.counts();
    const load = this.group === "ns" ? Math.max(counts.north, counts.south) : Math.max(counts.east, counts.west);
    this.phaseTimer = Math.min(30, this.greenDuration + Math.min(10, load * 0.6));
  }

  ringIsClear(dir) {
    const e = entryAngle(dir);
    return !this.cars.some((c) => c.phase === "ring" && norm360(c.angle - e) < RING_GAP_DEG);
  }

  step(dt) {
    this.elapsed += dt;
    this.updateLights(dt);

    for (const dir of DIRECTIONS) {
      this.spawnAcc[dir] += (this.config.spawnRate / 60) * dt;
      while (this.spawnAcc[dir] >= 1) {
        this.spawnAcc[dir] -= 1;
        this.spawnCar(dir);
      }
    }

    for (const dir of DIRECTIONS) {
      const light = this.lightFor(dir);
      const queue = this.cars
        .filter((c) => c.from === dir && c.phase === "approach")
        .sort((a, b) => a.dist - b.dist);
      const canEnter = light === "green" && this.ringIsClear(dir);
      queue.forEach((car, index) => {
        const ahead = queue[index - 1];
        let target = canEnter && index === 0 ? -Infinity : STOP_DIST;
        if (ahead) target = Math.max(target, ahead.dist + CAR_GAP);
        const room = car.dist - target;
        const desired = room <= 1 ? 0 : Math.min(car.maxSpeed, 30 + room * 2.2);
        car.speed += (desired - car.speed) * Math.min(1, dt * 4);
        car.dist -= car.speed * dt;
        if (car.speed < 6) car.waited += dt;
        car.blinking = index === 0 && light !== "green";
        if (index === 0 && canEnter && car.dist <= ENTRY_DIST) {
          const e = entryAngle(dir);
          car.phase = "ring";
          car.angle = e;
          car.arcLeft = norm360(e - exitAngle(car.to)) || 360;
          this.waitSum += car.waited;
          this.waitSamples += 1;
          this.maxWait = Math.max(this.maxWait, car.waited);
        }
      });
    }

    const ring = this.cars.filter((c) => c.phase === "ring").sort((a, b) => a.arcLeft - b.arcLeft);
    for (const car of ring) {
      let gap = 360;
      for (const other of ring) {
        if (other === car) continue;
        const d = norm360(car.angle - other.angle);
        if (d > 0 && d < gap) gap = d;
      }
      const target = gap <= RING_FOLLOW_DEG ? 0 : car.maxSpeed * 0.85;
      car.speed += (target - car.speed) * Math.min(1, dt * 5);
      const deltaDeg = ((car.speed * dt) / RING_R) * (180 / Math.PI);
      const move = Math.min(deltaDeg, car.arcLeft);
      car.angle = norm360(car.angle - move);
      car.arcLeft -= move;
      car.blinking = car.arcLeft < 40;
      if (car.arcLeft <= 0.001) {
        car.phase = "exit";
        car.dist = ENTRY_DIST;
      }
    }

    for (const car of this.cars) {
      if (car.phase !== "exit") continue;
      car.speed += (car.maxSpeed - car.speed) * Math.min(1, dt * 3);
      car.dist += car.speed * dt;
      car.blinking = false;
      if (car.dist > SPAWN_DIST) {
        car.phase = "done";
        this.passed += 1;
      }
    }
    this.cars = this.cars.filter((c) => c.phase !== "done");
  }

  poseOf(car) {
    if (car.phase === "ring") {
      const p = ringPoint(car.angle);
      const a = rad(car.angle);
      return { x: p.x, y: p.y, heading: Math.atan2(-Math.cos(a), Math.sin(a)) };
    }
    if (car.phase === "exit") {
      const p = outboundPoint(car.to, car.dist);
      const u = axis(car.to);
      return { x: p.x, y: p.y, heading: Math.atan2(u.y, u.x) };
    }
    const p = inboundPoint(car.from, car.dist);
    const u = axis(car.from);
    return { x: p.x, y: p.y, heading: Math.atan2(-u.y, -u.x) };
  }

  snapshot() {
    const counts = this.counts();
    const lights = {};
    for (const d of DIRECTIONS) {
      lights[d] = { color: this.lightFor(d), remaining: Math.max(0, this.phaseTimer) };
    }
    return {
      cars: this.cars,
      lights,
      counts,
      ringCount: this.cars.filter((c) => c.phase === "ring").length,
      activeGroup: this.group,
      phaseLabel:
        this.phase === "amber"
          ? "Transition (orange)"
          : this.group === "ns"
            ? "Vert Nord / Sud"
            : "Vert Est / Ouest",
      phaseRemaining: Math.max(0, this.phaseTimer),
      passed: this.passed,
      avgWait: this.waitSamples ? this.waitSum / this.waitSamples : 0,
      maxWait: this.maxWait,
      elapsed: this.elapsed,
      congested: this.congested(),
      aiPriority: this.aiPriority,
    };
  }
}