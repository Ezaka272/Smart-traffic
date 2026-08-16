const SIGNAL = {
  red: "#e0533f",
  amber: "#eeb03a",
  green: "#43cf8e",
};

const AXIS = {
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
  north: { x: 0, y: -1 },
};

function render(ctx, engine, size) {
  const s = size / WORLD;
  ctx.save();
  ctx.scale(s, s);
  ctx.clearRect(0, 0, WORLD, WORLD);

  const bg = ctx.createRadialGradient(WORLD / 2, WORLD / 2, 80, WORLD / 2, WORLD / 2, WORLD * 0.7);
  bg.addColorStop(0, "#2a3242");
  bg.addColorStop(1, "#1b2130");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WORLD, WORLD);

  drawRoads(ctx);
  drawRing(ctx);
  drawMarkings(ctx);
  drawLights(ctx, engine);
  drawCars(ctx, engine);
  drawLabels(ctx);
  ctx.restore();
}

function drawRoads(ctx) {
  ctx.fillStyle = "#39404e";
  const c = WORLD / 2;
  ctx.fillRect(0, c - ROAD_HALF, WORLD, ROAD_HALF * 2);
  ctx.fillRect(c - ROAD_HALF, 0, ROAD_HALF * 2, WORLD);
}

function drawRing(ctx) {
  const c = WORLD / 2;
  ctx.beginPath();
  ctx.arc(c, c, RING_R + ROAD_HALF * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = "#39404e";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, RING_R - ROAD_HALF * 0.72, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(c - 30, c - 40, 10, c, c, RING_R);
  g.addColorStop(0, "#4d6a52");
  g.addColorStop(1, "#33463a");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#e9ecef22";
  ctx.stroke();
}

function drawMarkings(ctx) {
  const c = WORLD / 2;
  ctx.strokeStyle = "#f4f6fa55";
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 20]);
  for (const dir of DIRECTIONS) {
    const u = AXIS[dir];
    ctx.beginPath();
    ctx.moveTo(c + u.x * (RING_R + 40), c + u.y * (RING_R + 40));
    ctx.lineTo(c + u.x * WORLD, c + u.y * WORLD);
    ctx.stroke();
  }

  ctx.setLineDash([14, 16]);
  ctx.strokeStyle = "#f4f6fa33";
  ctx.beginPath();
  ctx.arc(c, c, RING_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const dir of DIRECTIONS) {
    const a = inboundPoint(dir, RING_R + 26);
    const u = AXIS[dir];
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(Math.atan2(u.y, u.x));
    ctx.fillStyle = "#ffffff88";
    for (let i = -1; i <= 1; i++) ctx.fillRect(-4, i * 14 - 5, 8, 10);
    ctx.restore();
  }
}

function drawLights(ctx, engine) {
  for (const dir of DIRECTIONS) {
    const color = engine.lightFor(dir);
    const p = inboundPoint(dir, RING_R + 92);
    const u = AXIS[dir];
    const px = p.x + u.y * 30;
    const py = p.y - u.x * 30;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "#161a22";
    roundRect(ctx, -13, -34, 26, 68, 9);
    ctx.fill();
    ctx.strokeStyle = "#ffffff22";
    ctx.lineWidth = 2;
    ctx.stroke();

    const order = ["red", "amber", "green"];
    order.forEach((c, i) => {
      const on = c === color;
      ctx.beginPath();
      ctx.arc(0, -21 + i * 21, 8, 0, Math.PI * 2);
      ctx.fillStyle = on ? SIGNAL[c] : "#ffffff14";
      if (on) {
        ctx.shadowColor = SIGNAL[c];
        ctx.shadowBlur = 18;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }
}

function drawCars(ctx, engine) {
  for (const car of engine.cars) {
    const pose = engine.poseOf(car);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.heading);
    ctx.fillStyle = "#00000055";
    roundRect(ctx, -13, -8, 28, 17, 5);
    ctx.fill();
    ctx.fillStyle = car.color;
    roundRect(ctx, -14, -9, 28, 18, 5);
    ctx.fill();

    ctx.fillStyle = "#10151f88";
    roundRect(ctx, 2, -6, 8, 12, 3);
    ctx.fill();

    if (car.blinking) {
      const on = Math.floor(Date.now() / 300) % 2 === 0;
      if (on) {
        ctx.fillStyle = "#ffb340";
        ctx.beginPath();
        ctx.arc(-11, 6, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

function drawLabels(ctx) {
  const labels = {
    north: "NORD",
    south: "SUD",
    east: "EST",
    west: "OUEST",
  };
  ctx.font = "600 22px 'Space Grotesk', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff70";
  const c = WORLD / 2;
  for (const dir of DIRECTIONS) {
    const u = AXIS[dir];
    ctx.fillText(labels[dir], c + u.x * (WORLD / 2 - 40), c + u.y * (WORLD / 2 - 40));
  }
  ctx.font = "600 18px 'Space Grotesk', sans-serif";
  ctx.fillStyle = "#ffffff55";
  ctx.fillText("ROND-POINT", c, c);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}