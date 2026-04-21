// ============================================================
// ATLANTA HEAT FAN — v4 (Merged)
// 音频 + 状态机三步引导 + Ending + 调淡故事背景 + 侧边图片
// ============================================================

const CANVAS_W = 3072;
const CANVAS_H = 1280;
const COLS = 5;
const ROWS = 3;

let video;
let bodyPose;
let poses = [];
let pulseT = 0;

let scaleFactor = 0.4;
const SCALE_STEP = 0.05;

const CELL_STABILITY = 10;

// ── 三档配色 ─────────────────────────────────────────────────
const MINIMAL = { bg: "#EAEAEA", fan: "#FF3366", jacksNeeded: 5  };
const MEDIUM   = { bg: "#FF9F1C", fan: "#1C6EFF", jacksNeeded: 10 };
const HIGH     = { bg: "#E63946", fan: "#36E6D9", jacksNeeded: 20 };

// ── 状态机 ───────────────────────────────────────────────────
// 'calibration' → 'running' → 'completed' → 'calibration'
let appState = 'calibration';

// 标定三步状态（顺序激活，同时显示）
// step 0: 等待有人进入格子（鼻子检测到 cell）
// step 1: 提示做开合跳
// step 2: 完成第一个开合跳 → 进入 running
let calibStep = 0;
// 标定阶段检测到的 cell（用于显示"进入了格子"）
let calibDetectedCell = null;
// 标定阶段的开合跳状态（单人即可）
let calibArmsUp = false;

// Ending
const COMPLETION_DISPLAY_MS = 15000;
let completionTime = 0;

// ── 音频 ─────────────────────────────────────────────────────
let sounds = {};

// ── 故事版调淡背景（lerp 向白 65%）──────────────────────────
function getTintedBg(tier) {
  return lerpColor(color(tier.bg), color(255, 255, 255), 0.65);
}

// ── 故事内容 ─────────────────────────────────────────────────
const transcripts = {
  "OAKCLIFF": {
    context: "New resident calling a friend · Est. 15 seconds",
    audio: "OAKCLIFF",
    lines: [
      { speaker: "CALLER", text: "Honestly, it's my first Atlanta summer and I don't understand what people complain about. My building stays cool, I go outside, it's hot but I'm fine. I've never even thought about it.", delay: 0 }
    ]
  },
  "KINGS FOREST": {
    context: "Older resident calling their adult child · Est. 15 seconds",
    audio: "KINGS FOREST",
    lines: [
      { speaker: "CALLER", text: "Yo, I just got back from my walk. Those big old trees on the main stretch keep it so cool, I forget it's August out here for real. You should come visit before summer's even over man.", delay: 0 }
    ]
  },
  "ORMEWOOD PK": {
    context: "Teen calling a friend · Est. 15 seconds",
    audio: "ORMEWOOD PARK",
    lines: [
      { speaker: "CALLER", text: "Hey you want to go to the park by the creek later?", delay: 0 },
      { speaker: "FRIEND", text: "It's supposed to be 94 today.", delay: 2400 },
      { speaker: "CALLER", text: "Just bring water, there's plenty of shade out there, we'll be fine.", delay: 4200 }
    ]
  },
  "PLEASANT HILL": {
    context: "Friend calling friend · Est. 10 seconds",
    audio: "PLEASANT HILL",
    lines: [
      { speaker: "CALLER", text: "Hey! We're doing a neighborhood cookout Saturday, come through. And don't worry about the heat, if it gets too much we'll just head inside. The house stays cool.", delay: 0 }
    ]
  },
  "GEORGIA TECH": {
    context: "Facilities manager leaving a voicemail · Est. 15 seconds",
    audio: "GEORGIA TECH",
    lines: [
      { speaker: "CALLER", text: "Hey, just calling to let you know the HVAC upgrade is done across the whole engineering quad. Walked through at noon today, felt like a different city in there. Students won't feel the summer at all. Let me know if there's anything else that's needed.", delay: 0 }
    ]
  },
  "MT. PARAN": {
    context: "Resident calling a neighbor · Est. 15 seconds",
    audio: "MT. PARAN",
    lines: [
      { speaker: "CALLER",   text: "Hey, you got a fan I can borrow? My old AC is working overtime today.", delay: 0 },
      { speaker: "NEIGHBOR", text: "Yeah of course, come grab it.", delay: 3600 }
    ]
  },
  "EAST ATLANTA": {
    context: "Resident calling 311 · Est. 20 seconds",
    audio: "EAST ATLANTA",
    lines: [
      { speaker: "OPERATOR", text: "Thank you for calling 311, how can I help you?", delay: 0 },
      { speaker: "CALLER",   text: "The cooling center on Gresham is packed every afternoon. People coming in just to sit somewhere that isn't dangerous. We need more space before somebody collapses.", delay: 3500 }
    ]
  },
  "KIRKWOOD": {
    context: "Longtime resident calling a community aid line · Est. 20 seconds",
    audio: "KIRKWOOD",
    lines: [
      { speaker: "OPERATOR", text: "Hi, thank you for calling Kirkwood Cares, how can I help you?", delay: 0 },
      { speaker: "CALLER",   text: "My bedroom was 91 degrees at midnight. I'm waking up soaked every night. I've lived on this street 47 years and I can't afford to fix my roof. I just need to sleep.", delay: 4300 }
    ]
  },
  "LINDRIDGE": {
    context: "Resident calling Georgia Power · Est. 20 seconds",
    audio: "LINDRIDGE",
    lines: [
      { speaker: "REP",    text: "Thank you for calling Georgia Power, how can I assist you today?", delay: 0 },
      { speaker: "CALLER", text: "My bill has been climbing every summer for three years. This month I can barely cover it and I have children in this house. What is going on?", delay: 4600 }
    ]
  },
  "CASCADE RD": {
    context: "Resident calling apartment management · Est. 20 seconds",
    audio: "CASCADE ROAD",
    lines: [
      { speaker: "CALLER",  text: "My AC has been out for eight days. Last night it was 88 degrees inside at 11pm and my kid could not sleep. Eight days.", delay: 0 },
      { speaker: "MANAGER", text: "We're waiting on a part, it'll come in next week. Hold tight.", delay: 9600 }
    ]
  },
  "GREENBRIAR": {
    context: "Resident calling 311 · Est. 25 seconds",
    audio: "GREENBRIAR",
    lines: [
      { speaker: "OPERATOR", text: "Thank you for calling 311, how can I help you?", delay: 0 },
      { speaker: "CALLER",   text: "With this heat wave, this summer has been a nightmare. My neighbor's kid has been in and out of the hospital with her asthma and my elderly neighbor collapsed from heat exhaustion last week. Is there anything, any funding, any support at all?", delay: 3300 }
    ]
  },
  "BANKHEAD": {
    context: "Adult child calling a sibling · Est. 20 seconds",
    audio: "BANKHEAD",
    lines: [
      { speaker: "CALLER",  text: "I just got to his house. He's been in one room all day with the door closed trying to keep the cool air in. It's one room. The rest of the house is suffocating.", delay: 0 },
      { speaker: "SIBLING", text: "We need to start putting money together for another unit before this gets worse.", delay: 8900 }
    ]
  },
  "WASHINGTON PK": {
    context: "Family member calling a relative · Est. 20 seconds",
    audio: "WASHINGTON PARK",
    lines: [
      { speaker: "CALLER", text: "Mama, Ann told me you've been turning the AC off because the bill got too high. You cannot do that in this heat. Please turn it back on.", delay: 0 },
      { speaker: "MAMA",   text: "You know, I know it's hot, but I still got groceries to buy this week.", delay: 7400 }
    ]
  },
  "ENGLISH AVE": {
    context: "Resident calling a family member · Est. 20 seconds",
    audio: "ENGLISH AVENUE",
    lines: [
      { speaker: "CALLER", text: "I just checked on Grandma. She had a cold wet towel on her neck and was trying to sit completely still to not generate any body heat. It's 94 degrees in her living room, I don't even know what to do.", delay: 0 }
    ]
  },
  "PITTSBURGH": {
    context: "Neighbor calling 911 · Est. 25 seconds",
    audio: "PITTSBURGH",
    lines: [
      { speaker: "DISPATCHER", text: "911 what's your emergency?", delay: 0 },
      { speaker: "CALLER",     text: "I need help, my neighbor Patricia, she's 65 and lives alone. I came to check on her and she's not responding. It's like an oven in there. We've been complaining about this neighborhood for years, nothing ever changes. Oh my god, please hurry.", delay: 2600 }
    ]
  }
};

const audioDurations = {
  "BANKHEAD":      15000,
  "CASCADE RD":    15000,
  "EAST ATLANTA":  13000,
  "ENGLISH AVE":   13000,
  "GEORGIA TECH":  15000,
  "GREENBRIAR":    18000,
  "KINGS FOREST":  10000,
  "KIRKWOOD":      18000,
  "LINDRIDGE":     12000,
  "MT. PARAN":      6000,
  "OAKCLIFF":      10000,
  "ORMEWOOD PK":    9000,
  "PITTSBURGH":    18000,
  "PLEASANT HILL": 10000,
  "WASHINGTON PK": 13000,
};

// ── 邻居数据 ─────────────────────────────────────────────────
const neighborhoods = [
  { name: "MT. PARAN",     col: 0, row: 0, tier: MEDIUM  },
  { name: "PLEASANT HILL", col: 1, row: 0, tier: MINIMAL },
  { name: "OAKCLIFF",      col: 2, row: 0, tier: MINIMAL },
  { name: "KINGS FOREST",  col: 3, row: 0, tier: MINIMAL },
  { name: "LINDRIDGE",     col: 4, row: 0, tier: MEDIUM  },
  { name: "BANKHEAD",      col: 0, row: 1, tier: HIGH    },
  { name: "ENGLISH AVE",   col: 1, row: 1, tier: HIGH    },
  { name: "GEORGIA TECH",  col: 2, row: 1, tier: MINIMAL },
  { name: "KIRKWOOD",      col: 3, row: 1, tier: MEDIUM  },
  { name: "EAST ATLANTA",  col: 4, row: 1, tier: MEDIUM  },
  { name: "CASCADE RD",    col: 0, row: 2, tier: MEDIUM  },
  { name: "GREENBRIAR",    col: 1, row: 2, tier: MEDIUM  },
  { name: "WASHINGTON PK", col: 2, row: 2, tier: HIGH    },
  { name: "PITTSBURGH",    col: 3, row: 2, tier: HIGH    },
  { name: "ORMEWOOD PK",   col: 4, row: 2, tier: MINIMAL },
];

let cellStates = {};
for (let n of neighborhoods) {
  cellStates[n.name] = {
    angle: 0, speed: 0, done: false,
    jackCount: 0,
    expanding: false, shrinking: false, expandT: 0,
    transcriptLine: -1, transcriptTimers: [],
    lineAlphas: [],
  };
}

let personStates = {};
let cellW, cellH;
let fullscreenCell = null;
let completionQueue = [];
let pg;

// 侧边图片
let imgJump, imgJumpingJack;

// ── 骨架连接 ─────────────────────────────────────────────────
const SKELETON_CONNECTIONS = [
  ["left_shoulder","right_shoulder"],
  ["left_shoulder","left_elbow"],   ["left_elbow","left_wrist"],
  ["right_shoulder","right_elbow"], ["right_elbow","right_wrist"],
  ["left_shoulder","left_hip"],     ["right_shoulder","right_hip"],
  ["left_hip","right_hip"],
  ["left_hip","left_knee"],         ["left_knee","left_ankle"],
  ["right_hip","right_knee"],       ["right_knee","right_ankle"],
];

// ============================================================
// PRELOAD
// ============================================================
function preload() {
  imgJump        = loadImage('jump.png',         () => {}, () => { imgJump = null; });
  imgJumpingJack = loadImage('jumping jack.png', () => {}, () => { imgJumpingJack = null; });
  for (let key in transcripts) {
    let t = transcripts[key];
    sounds[key] = loadSound("Phonecalls/" + t.audio + ".mp3");
  }
}

// ============================================================
// SETUP
// ============================================================
function setup() {
  createCanvas(floor(CANVAS_W * scaleFactor), floor(CANVAS_H * scaleFactor));
  pg = createGraphics(CANVAS_W, CANVAS_H);
  cellW = CANVAS_W / COLS;
  cellH = CANVAS_H / ROWS;
  video = createCapture(VIDEO);
  video.size(CANVAS_W, CANVAS_H);
  video.hide();
  bodyPose = ml5.bodyPose("MoveNet", { flipped: true, multiPose: true }, modelReady);
  textFont("Arial");
  pg.textFont("Arial");
}

function modelReady() { bodyPose.detect(video, gotPoses); }
function gotPoses(results) { poses = results; bodyPose.detect(video, gotPoses); }

function keyPressed() {
  if (keyCode === UP_ARROW)        scaleFactor += SCALE_STEP;
  else if (keyCode === DOWN_ARROW) scaleFactor = max(scaleFactor - SCALE_STEP, 0.05);
  resizeCanvas(floor(CANVAS_W * scaleFactor), floor(CANVAS_H * scaleFactor));
}

// ============================================================
// COORD UTILS
// ============================================================
function getCell(x, y) {
  let col = constrain(floor(x / cellW), 0, COLS - 1);
  let row = constrain(floor(y / cellH), 0, ROWS - 1);
  return neighborhoods.find(n => n.col === col && n.row === row);
}

function getKeypoints(pose) {
  let kps = {};
  for (let kp of pose.keypoints) {
    let x = kp.x * (CANVAS_W / video.width);
    let y = kp.y * (CANVAS_H / video.height);
    kps[kp.name] = { x, y, confidence: kp.confidence || kp.score };
  }
  return kps;
}

// ============================================================
// MAIN DRAW
// ============================================================
function draw() {
  pulseT += 0.05;

  if (appState === 'calibration') {
    drawCalibrationScreen();
  } else if (appState === 'completed') {
    drawCompletionScreen();
  } else {
    drawRunningScreen();
  }

  background(0);
  image(pg, 0, 0, width, height);
}

// ============================================================
// CALIBRATION SCREEN — 三步顺序激活
// ============================================================
function drawCalibrationScreen() {
  // 深色热浪渐变背景
  for (let i = 0; i < 20; i++) {
    let t = i / 20;
    let c = lerpColor(color(12, 10, 8), color(60, 18, 8), t);
    pg.noStroke();
    pg.fill(red(c), green(c), blue(c));
    pg.rect(0, t * CANVAS_H, CANVAS_W, CANVAS_H / 20 + 1);
  }

  // 侧边图片
  let imgW   = CANVAS_W * 0.42;
  let imgPad = CANVAS_W * 0.015;
  if (imgJump) {
    let ih = imgJump.height * (imgW / imgJump.width);
    pg.image(imgJump, imgPad, CANVAS_H / 2 - ih / 2, imgW, ih);
  }
  if (imgJumpingJack) {
    let ih = imgJumpingJack.height * (imgW / imgJumpingJack.width);
    pg.image(imgJumpingJack, CANVAS_W - imgPad - imgW, CANVAS_H / 2 - ih / 2, imgW, ih);
  }

  // 骨架（检测到的所有人）
  for (let pose of poses) {
    let kps  = getKeypoints(pose);
    let tier = getCalibTier(kps);
    drawSketchSkeleton(kps, tier);
  }

  // 更新标定步骤
  updateCalibStep();

  // ── 三步 UI ──────────────────────────────────────────────
  drawCalibSteps();

  // 脚部参考线
  drawStandHereLine();

  // 底部说明
  pg.fill(140, 80, 42);
  pg.textStyle(NORMAL);
  pg.textSize(CANVAS_H * 0.022);
  pg.textAlign(CENTER, BOTTOM);
  pg.noStroke();
  pg.text("Do jumping jacks to spin the fans  ·  Reveal Atlanta's heat stories",
          CANVAS_W / 2, CANVAS_H - 20);
}

// 获取当前标定时某人所在格子颜色（用于骨架着色）
function getCalibTier(kps) {
  let nose = kps['nose'];
  if (!nose || nose.confidence < 0.2) return MINIMAL;
  let cell = getCell(nose.x, nose.y);
  return cell ? cell.tier : MINIMAL;
}

// 骨架绘制（sketch 风格：黑色粗线 + 鼻子脉冲光晕）
function drawSketchSkeleton(kps, tier) {
  let fc = color(tier ? tier.fan : "#FF3366");

  pg.stroke(0, 0, 0, 180);
  pg.strokeWeight(18);
  pg.strokeCap(ROUND);
  for (let [a, b] of SKELETON_CONNECTIONS) {
    if (kps[a] && kps[b] && kps[a].confidence > 0.2 && kps[b].confidence > 0.2) {
      pg.line(kps[a].x, kps[a].y, kps[b].x, kps[b].y);
    }
  }

  if (kps['nose'] && kps['nose'].confidence > 0.2) {
    let hx    = kps['nose'].x;
    let hy    = kps['nose'].y;
    let pulse = sin(pulseT) * 0.5 + 0.5;
    pg.noStroke();
    pg.fill(red(fc), green(fc), blue(fc), 40 + pulse * 30); pg.circle(hx, hy, 160);
    pg.fill(red(fc), green(fc), blue(fc), 80 + pulse * 40); pg.circle(hx, hy, 110);
    pg.fill(red(fc), green(fc), blue(fc), 255);             pg.circle(hx, hy, 70);
    pg.fill(255, 255, 255, 180);                            pg.circle(hx, hy, 36);
    pg.fill(255, 255, 255, 255);                            pg.circle(hx, hy, 14);
  }
}

/**
 * 三步顺序激活逻辑：
 * calibStep 0 → 检测到鼻子进入任意格子 → 升至 1
 * calibStep 1 → 检测到双手举起（准备开合跳）→ 升至 2
 * calibStep 2 → 完成一个完整开合跳 → 进入 running
 */
function updateCalibStep() {
  if (poses.length === 0) return;

  for (let pose of poses) {
    let kps  = getKeypoints(pose);
    let nose = kps['nose'];
    let lw   = kps['left_wrist'],  rw  = kps['right_wrist'];
    let ls   = kps['left_shoulder'], rs = kps['right_shoulder'];

    // Step 0 → 1：检测到鼻子进入格子
    if (calibStep === 0) {
      if (nose && nose.confidence > 0.2) {
        let cell = getCell(nose.x, nose.y);
        if (cell) {
          calibDetectedCell = cell;
          calibStep = 1;
        }
      }
    }

    // Step 1 → 2：双手腕可见且置信度足够
    if (calibStep === 1) {
      if (lw && rw && ls && rs &&
          lw.confidence > 0.3 && rw.confidence > 0.3 &&
          ls.confidence > 0.3 && rs.confidence > 0.3) {
        calibStep = 2;
      }
    }

    // Step 2：检测完整开合跳（双手举过肩 → 放下）
    if (calibStep === 2) {
      let allValid = lw && rw && ls && rs &&
        lw.confidence > 0.2 && rw.confidence > 0.2 &&
        ls.confidence > 0.2 && rs.confidence > 0.2;
      if (allValid) {
        let bothUp = lw.y < ls.y && rw.y < rs.y;
        if (bothUp && !calibArmsUp) {
          calibArmsUp = true;
        } else if (!bothUp && calibArmsUp) {
          // 完成一次开合跳 → 进入 running
          calibArmsUp = false;
          appState    = 'running';
          return;
        }
      }
    }
  }
}

// 动画人形插值变量
let figT = 0;
let figDir = 1;

// 三步 HUD（队友动画版）
function drawCalibSteps() {
  let pillH  = CANVAS_H * 0.10;
  let hudY   = CANVAS_H * 0.72;
  let pad    = CANVAS_W * 0.016;
  let gap    = CANVAS_W * 0.008;
  let arrowW = CANVAS_W * 0.012;
  let figW   = pillH * 1.1;

  // 动画人形插值推进
  figT += 0.025 * figDir;
  if (figT >= 1) { figT = 1; figDir = -1; }
  if (figT <= 0) { figT = 0; figDir =  1; }
  let ease = figT < 0.5 ? 2 * figT * figT : -1 + (4 - 2 * figT) * figT;

  pg.textSize(pillH * 0.28);
  pg.textStyle(BOLD);
  pg.noStroke();

  let p1a = "STEP INTO A NEIGHBORHOOD ";
  let p1b = "HEAD FIRST";
  let p2a = "DO JUMPING JACKS ";
  let p2b = "TO SPIN THE FAN";
  let p3text = "DO A JUMPING JACK TO BEGIN";

  let p1W = pg.textWidth(p1a + p1b) + pad * 2;
  let p2W = pg.textWidth(p2a + p2b) + pad * 2 + figW + gap * 0.3;
  let p3W = pg.textWidth(p3text) + pad * 2;
  let totalHudW = p1W + gap + arrowW + gap + p2W + gap + arrowW + gap + p3W;
  let hx = (CANVAS_W - totalHudW) / 2;
  let cy = hudY + pillH / 2;

  let orange = color(255, 120, 0);
  let dark   = color(15, 15, 15);

  // ── Pill 1 ──────────────────────────────────────────────
  let p1Active = calibStep >= 1;
  pg.noStroke();
  pg.fill(dark);
  pg.rect(hx, hudY, p1W, pillH, pillH / 2);
  if (p1Active) {
    pg.noFill();
    pg.stroke(255, 120, 0, 80);
    pg.strokeWeight(3);
    pg.rect(hx, hudY, p1W, pillH, pillH / 2);
  }
  pg.noStroke();
  pg.textAlign(LEFT, CENTER);
  pg.fill(p1Active ? color(255) : color(120, 120, 120));
  pg.text(p1a, hx + pad, cy);
  pg.fill(p1Active ? orange : color(80, 80, 80));
  pg.text(p1b, hx + pad + pg.textWidth(p1a), cy);

  // ── Arrow 1 ─────────────────────────────────────────────
  let ax1 = hx + p1W + gap;
  pg.fill(p1Active ? color(255, 255, 255, 100) : color(50, 50, 50));
  pg.textAlign(CENTER, CENTER);
  pg.textSize(pillH * 0.4);
  pg.text("->", ax1 + arrowW / 2, cy);
  pg.textSize(pillH * 0.28);

  // ── Pill 2 ──────────────────────────────────────────────
  let p2Active = calibStep >= 2;
  let p2X = ax1 + arrowW + gap;
  pg.noStroke();
  pg.fill(dark);
  pg.rect(p2X, hudY, p2W, pillH, pillH / 2);
  if (p2Active) {
    pg.noFill();
    pg.stroke(255, 120, 0, 80);
    pg.strokeWeight(3);
    pg.rect(p2X, hudY, p2W, pillH, pillH / 2);
  }
  pg.noStroke();
  // 动画人形图标
  drawCalibFigure(p2X + pad * 0.4, hudY + pillH * 0.05, pillH * 0.9, ease, p2Active);
  let p2TextX = p2X + pad * 0.4 + figW + gap * 0.2;
  pg.textAlign(LEFT, CENTER);
  pg.fill(p2Active ? color(255) : color(120, 120, 120));
  pg.text(p2a, p2TextX, cy);
  pg.fill(p2Active ? orange : color(80, 80, 80));
  pg.text(p2b, p2TextX + pg.textWidth(p2a), cy);

  // ── Arrow 2 ─────────────────────────────────────────────
  let ax2 = p2X + p2W + gap;
  pg.fill(p2Active ? color(255, 255, 255, 100) : color(50, 50, 50));
  pg.textAlign(CENTER, CENTER);
  pg.textSize(pillH * 0.4);
  pg.text("->", ax2 + arrowW / 2, cy);
  pg.textSize(pillH * 0.28);

  // ── Pill 3（CTA，激活时橙色实心 + 脉冲）────────────────
  let p3X = ax2 + arrowW + gap;
  let p3Active = calibStep >= 2;
  let pillPulse = sin(pulseT * 1.4) * 0.5 + 0.5;
  pg.noStroke();
  pg.fill(p3Active
    ? color(red(orange), green(orange), blue(orange), 190 + pillPulse * 65)
    : dark);
  pg.rect(p3X, hudY, p3W, pillH, pillH / 2);
  pg.fill(255);
  pg.textAlign(LEFT, CENTER);
  pg.text(p3text, p3X + pad, cy);
}

// 动画人形（开合跳姿势，带脉冲光晕）
function drawCalibFigure(x, y, size, ease, active) {
  let cx        = x + size * 0.5;
  let headY     = y + size * 0.08;
  let shoulderY = y + size * 0.26;
  let hipY      = y + size * 0.60;
  let armAngle  = lerp(PI / 5, -PI / 1.5, ease);
  let legSpread = lerp(0, PI * 0.22, ease);
  let pulse     = sin(pulseT) * 0.5 + 0.5;
  let fc        = active ? color(255, 120, 0) : color(70, 70, 70);

  pg.noStroke();
  pg.fill(red(fc), green(fc), blue(fc), 40 + pulse * 30); pg.circle(cx, headY, size * 0.32);
  pg.fill(red(fc), green(fc), blue(fc), 80 + pulse * 40); pg.circle(cx, headY, size * 0.24);
  pg.fill(red(fc), green(fc), blue(fc));                  pg.circle(cx, headY, size * 0.16);
  pg.fill(255, 255, 255, 180);                            pg.circle(cx, headY, size * 0.08);
  pg.fill(255);                                           pg.circle(cx, headY, size * 0.03);

  pg.stroke(red(fc), green(fc), blue(fc), 220);
  pg.strokeCap(ROUND);
  pg.strokeWeight(size * 0.09);
  pg.line(cx, shoulderY, cx, hipY);

  let armLen = size * 0.3;
  pg.strokeWeight(size * 0.08);
  pg.line(cx, shoulderY, cx - sin(armAngle) * armLen * 0.6, shoulderY + cos(armAngle) * armLen);
  pg.line(cx, shoulderY, cx + sin(armAngle) * armLen * 0.6, shoulderY + cos(armAngle) * armLen);

  let legLen = size * 0.38;
  pg.line(cx, hipY, cx - sin(legSpread) * legLen * 0.8, hipY + cos(legSpread) * legLen);
  pg.line(cx, hipY, cx + sin(legSpread) * legLen * 0.8, hipY + cos(legSpread) * legLen);
  pg.noStroke();
}

function drawStandHereLine() {
  let pulse  = sin(pulseT) * 0.5 + 0.5;
  let lineY  = CANVAS_H * 0.90;
  let lineX1 = CANVAS_W * 0.20;
  let lineX2 = CANVAS_W * 0.80;

  pg.stroke(255, 160, 40, lerp(25, 55, pulse));   pg.strokeWeight(28); pg.line(lineX1, lineY, lineX2, lineY);
  pg.stroke(255, 170, 60, lerp(60, 120, pulse));  pg.strokeWeight(10); pg.line(lineX1, lineY, lineX2, lineY);
  pg.stroke(255, 200, 100, lerp(180, 255, pulse)); pg.strokeWeight(3);  pg.line(lineX1, lineY, lineX2, lineY);
  pg.noStroke();
  pg.fill(255, 200, 100, lerp(180, 255, pulse));
  pg.textAlign(CENTER, BOTTOM); pg.textStyle(BOLD); pg.textSize(CANVAS_H * 0.034);
  pg.text('▼  STAND HERE  ▼', CANVAS_W / 2, lineY - 16);
  pg.textAlign(LEFT, TOP); pg.textStyle(NORMAL);
}

// ============================================================
// RUNNING SCREEN
// ============================================================
function drawRunningScreen() {
  pg.background(0);

  for (let n of neighborhoods) {
    let s = cellStates[n.name];
    if (!s.done) { s.angle += s.speed; s.speed *= 0.97; }
  }

  for (let n of neighborhoods) {
    if (!fullscreenCell || fullscreenCell.name !== n.name) drawCell(n);
  }

  if (!fullscreenCell) {
    let activeIds = new Set(poses.map((_, i) => i));
    for (let id in personStates) {
      if (!activeIds.has(parseInt(id))) delete personStates[id];
    }
    for (let i = 0; i < poses.length; i++) {
      let kps = getKeypoints(poses[i]);
      if (!personStates[i]) {
        personStates[i] = { armsUp: false, currentCell: null, cellBuffer: null, cellBufferCount: 0 };
      }
      drawShadow(kps, personStates[i]);
      detectCell(kps, personStates[i]);
      detectJumpingJack(kps, personStates[i]);
    }
  }

  if (fullscreenCell) drawFullscreen(fullscreenCell);
}

// ============================================================
// SHADOW（运行中骨架，复用 drawSketchSkeleton）
// ============================================================
function drawShadow(kps, ps) {
  let tier = ps.currentCell ? ps.currentCell.tier : MINIMAL;
  drawSketchSkeleton(kps, tier);
}

// ============================================================
// CELL & JUMPING JACK DETECTION
// ============================================================
function detectCell(kps, ps) {
  let nose = kps["nose"];
  if (!nose || nose.confidence < 0.2) return;
  let candidate = getCell(nose.x, nose.y);
  if (!candidate) return;

  if (ps.cellBuffer && ps.cellBuffer.name === candidate.name) {
    ps.cellBufferCount++;
  } else {
    ps.cellBuffer = candidate;
    ps.cellBufferCount = 1;
  }
  if (ps.cellBufferCount >= CELL_STABILITY) {
    if (!ps.currentCell || ps.currentCell.name !== candidate.name) {
      ps.currentCell = candidate;
    }
  }
}

function detectJumpingJack(kps, ps) {
  if (!ps.currentCell) return;
  let s = cellStates[ps.currentCell.name];
  if (s.done) return;

  let lw = kps["left_wrist"],  rw = kps["right_wrist"];
  let ls = kps["left_shoulder"], rs = kps["right_shoulder"];
  let allValid = lw && rw && ls && rs &&
    lw.confidence > 0.2 && rw.confidence > 0.2 &&
    ls.confidence > 0.2 && rs.confidence > 0.2;
  if (!allValid) return;

  let bothUp = lw.y < ls.y && rw.y < rs.y;
  if (bothUp && !ps.armsUp) {
    ps.armsUp = true;
  } else if (!bothUp && ps.armsUp) {
    ps.armsUp = false;
    s.jackCount++;
    s.speed += TWO_PI / ps.currentCell.tier.jacksNeeded;
    if (s.jackCount >= ps.currentCell.tier.jacksNeeded) queueCompletion(ps.currentCell);
  }
}

// ============================================================
// COMPLETION QUEUE
// ============================================================
function queueCompletion(n) {
  let s = cellStates[n.name];
  if (s.done) return;
  s.done  = true;
  s.speed = 0;
  completionQueue.push(n);
  if (!fullscreenCell) playNextCompletion();
}

function playNextCompletion() {
  if (completionQueue.length === 0) {
    // 队列空 → 检查是否全部完成
    if (neighborhoods.every(n => cellStates[n.name].done)) {
      completionTime = millis();
      appState = 'completed';
    }
    return;
  }

  let n = completionQueue.shift();
  fullscreenCell = n;

  let s  = cellStates[n.name];
  s.expanding = true;
  s.expandT   = 0;

  let tr = transcripts[n.name];
  if (!tr) return;

  s.lineAlphas = tr.lines.map(() => 0);

  let expandDuration = 1200;

  // 展开后播放音频
  if (sounds[n.name] && sounds[n.name].isLoaded()) {
    setTimeout(() => sounds[n.name].play(), expandDuration);
  }

  // 按 delay 字段逐行显示字幕
  tr.lines.forEach((line, i) => {
    let t = setTimeout(() => { s.transcriptLine = i; }, expandDuration + line.delay);
    s.transcriptTimers.push(t);
  });

  let audioDur   = audioDurations[n.name] || 15000;
  let shrinkDelay = expandDuration + audioDur;

  setTimeout(() => { s.expanding = false; s.shrinking = true; }, shrinkDelay);
  setTimeout(() => {
    s.shrinking      = false;
    s.expandT        = 0;
    s.transcriptLine = -1;
    s.lineAlphas     = [];
    fullscreenCell   = null;
    playNextCompletion();
  }, shrinkDelay + 900);
}

// ============================================================
// FULLSCREEN STORY — 调淡背景色
// ============================================================
function drawFullscreen(n) {
  let s = cellStates[n.name];

  if (s.expanding && s.expandT < 1) s.expandT = min(s.expandT + 0.04, 1);
  if (s.shrinking && s.expandT > 0) s.expandT = max(s.expandT - 0.05, 0);

  let t  = easeInOut(s.expandT);
  let tx = n.col * cellW, ty = n.row * cellH;
  let rx = lerp(tx, 0, t), ry = lerp(ty, 0, t);
  let rw = lerp(cellW, CANVAS_W, t);
  let rh = lerp(cellH, CANVAS_H, t);

  // 调淡背景色
  let tintedBg = getTintedBg(n.tier);
  pg.fill(red(tintedBg), green(tintedBg), blue(tintedBg));
  pg.noStroke();
  pg.rect(rx, ry, rw, rh);

  if (t > 0.85) {
    let tr = transcripts[n.name];
    if (!tr) return;

    let alpha = map(t, 0.85, 1.0, 0, 255);
    for (let i = 0; i < tr.lines.length; i++) {
      if (i <= s.transcriptLine) s.lineAlphas[i] = min(s.lineAlphas[i] + 8, alpha);
    }

    let speakerH = CANVAS_H * 0.055;
    let tSize    = CANVAS_H * 0.048;
    let lineGap  = CANVAS_H * 0.02;
    let blockGap = CANVAS_H * 0.055;
    let padX     = CANVAS_W * 0.1;
    let headerH  = CANVAS_H * 0.22;

    let totalH = 0;
    for (let i = 0; i < tr.lines.length; i++) {
      let wraps = max(0, floor(tr.lines[i].text.length / 80));
      totalH += speakerH + tSize * (1.4 + wraps * 1.4) + lineGap;
      if (i < tr.lines.length - 1) totalH += blockGap;
    }
    let startY = headerH + max(0, (CANVAS_H - headerH - totalH) / 2) * 0.6;

    // 区域名（fan 色，对比淡背景）
    let fanC = color(n.tier.fan);
    pg.fill(red(fanC), green(fanC), blue(fanC), alpha);
    pg.noStroke(); pg.textAlign(LEFT, TOP); pg.textStyle(BOLD);
    pg.textSize(CANVAS_H * 0.06);
    pg.text(n.name, padX, CANVAS_H * 0.06);

    // context
    pg.fill(40, 40, 40, alpha * 0.55);
    pg.textStyle(NORMAL); pg.textSize(CANVAS_H * 0.032);
    pg.text(tr.context, padX, CANVAS_H * 0.14);

    let yPos = startY;
    for (let i = 0; i < tr.lines.length; i++) {
      let la = s.lineAlphas[i];

      // speaker
      pg.fill(red(fanC), green(fanC), blue(fanC), la * 0.9);
      pg.textStyle(BOLD); pg.textSize(CANVAS_H * 0.032); pg.textAlign(LEFT, TOP);
      pg.text(tr.lines[i].speaker, padX, yPos);
      yPos += speakerH;

      // 台词
      pg.fill(20, 20, 20, la);
      pg.textStyle(NORMAL); pg.textSize(tSize); pg.textWrap(WORD);
      pg.text(tr.lines[i].text, padX, yPos, CANVAS_W * 0.8);

      let wraps = max(0, floor(tr.lines[i].text.length / 80));
      yPos += tSize * (1.4 + wraps * 1.4) + lineGap;
      if (i < tr.lines.length - 1) yPos += blockGap;
    }
  }
}

// ============================================================
// COMPLETION / ENDING SCREEN
// ============================================================
function drawCompletionScreen() {
  let elapsed = millis() - completionTime;
  pg.background(10);

  // 淡色格子背景（ghost grid）
  let tiers = [
    "M","m","m","m","M",
    "H","H","m","M","M",
    "M","M","H","H","m"
  ];
  let gw = CANVAS_W / 5;
  let gh = CANVAS_H / 3;
  for (let i = 0; i < 15; i++) {
    let col = i % 5;
    let row = floor(i / 5);
    let t   = tiers[i];
    let c   = t === "m" ? color(234, 234, 234) :
              t === "M" ? color(255, 159,  28) :
                          color(230,  57,  70);
    pg.fill(red(c), green(c), blue(c), 18);
    pg.noStroke();
    pg.rect(col * gw, row * gh, gw, gh);
  }

  let masterAlpha = constrain(map(elapsed, 0, 2000, 0, 255), 0, 255);

  // 引言（白色）
  pg.noStroke();
  pg.fill(255, 255, 255, masterAlpha);
  pg.textAlign(CENTER, CENTER);
  pg.textStyle(NORMAL);
  pg.textSize(CANVAS_H * 0.042);
  pg.textLeading(CANVAS_H * 0.065);
  pg.text(
    "Atlanta's heat does not fall equally.\n" +
    "Some neighborhoods have always lived in it.\n" +
    "Others have always had the option to leave.",
    CANVAS_W / 2, CANVAS_H / 2 - CANVAS_H * 0.18
  );

  // 分隔线
  pg.stroke(230, 57, 70, masterAlpha * 0.6);
  pg.strokeWeight(2);
  let lineLen = CANVAS_W * 0.06;
  pg.line(CANVAS_W / 2 - lineLen, CANVAS_H / 2 - CANVAS_H * 0.02,
          CANVAS_W / 2 + lineLen, CANVAS_H / 2 - CANVAS_H * 0.02);
  pg.noStroke();

  // 核心问句（"burn?" 单独红色）
  let qAlpha  = constrain(map(elapsed, 800, 3000, 0, 255), 0, 255);
  let lineY1  = CANVAS_H / 2 + CANVAS_H * 0.08;
  let lineY2  = CANVAS_H / 2 + CANVAS_H * 0.175;
  let line1   = "Who decided which communities";
  let line2a  = "would be left to ";
  let line2b  = "burn?";

  pg.textStyle(BOLD);
  pg.textSize(CANVAS_H * 0.082);
  pg.textLeading(CANVAS_H * 0.11);

  pg.fill(255, 255, 255, qAlpha);
  pg.textAlign(CENTER, CENTER);
  pg.text(line1, CANVAS_W / 2, lineY1);

  pg.textAlign(LEFT, CENTER);
  let line2aW     = pg.textWidth(line2a);
  let line2bW     = pg.textWidth(line2b);
  let line2StartX = CANVAS_W / 2 - (line2aW + line2bW) / 2;
  pg.fill(255, 255, 255, qAlpha);
  pg.text(line2a, line2StartX, lineY2);
  pg.fill(230, 57, 70, qAlpha);
  pg.text(line2b, line2StartX + line2aW, lineY2);

  // 倒计時（最後 5 秒）
  if (elapsed > COMPLETION_DISPLAY_MS - 5000) {
    let ctAlpha   = constrain(map(elapsed, COMPLETION_DISPLAY_MS - 5000, COMPLETION_DISPLAY_MS - 3000, 0, 120), 0, 120);
    let remaining = max(0, ceil((COMPLETION_DISPLAY_MS - elapsed) / 1000));
    pg.fill(255, 255, 255, ctAlpha);
    pg.textStyle(NORMAL);
    pg.textSize(CANVAS_H * 0.022);
    pg.textAlign(CENTER, CENTER);
    pg.noStroke();
    pg.text("Resetting in " + remaining + "...", CANVAS_W / 2, CANVAS_H - CANVAS_H * 0.06);
  }

  if (elapsed >= COMPLETION_DISPLAY_MS) resetAll();
}

// ── 全局重置 → 回到标定 ──────────────────────────────────────
function resetAll() {
  for (let n of neighborhoods) {
    cellStates[n.name] = {
      angle: 0, speed: 0, done: false,
      jackCount: 0,
      expanding: false, shrinking: false, expandT: 0,
      transcriptLine: -1, transcriptTimers: [],
      lineAlphas: [],
    };
  }
  personStates    = {};
  fullscreenCell  = null;
  completionQueue = [];
  calibStep       = 0;
  calibDetectedCell = null;
  calibArmsUp     = false;
  figT            = 0;
  figDir          = 1;
  appState        = 'calibration';
}

// ============================================================
// CELL & FAN DRAW
// ============================================================
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function drawCell(n) {
  let s = cellStates[n.name];
  let x = n.col * cellW, y = n.row * cellH;

  pg.fill(n.tier.bg); pg.noStroke(); pg.rect(x, y, cellW, cellH);

  let fanX = x + cellW / 2;
  let fanY = y + cellH * 0.44;
  let r    = min(cellW, cellH) * 0.33;

  drawFan(fanX, fanY, r, n.tier.bg, n.tier.fan, s.angle);

  pg.fill(color(n.tier.fan)); pg.noStroke();
  pg.textAlign(CENTER, TOP); pg.textStyle(BOLD); pg.textSize(cellH * 0.07);
  pg.text(n.name, fanX, fanY + r + cellH * 0.055);

  if (s.done) { pg.fill(0, 0, 0, 165); pg.rect(x, y, cellW, cellH); }
}

function drawFan(cx, cy, r, bgCol, fanCol, angle) {
  pg.push();
  pg.translate(cx, cy);
  let fc = color(fanCol), bc = color(bgCol);

  pg.fill(fc); pg.noStroke(); pg.circle(0, 0, r * 2.22);
  pg.fill(bc); pg.circle(0, 0, r * 2.0);

  pg.push(); pg.rotate(angle);
  for (let i = 0; i < 5; i++) {
    pg.push(); pg.rotate((TWO_PI / 5) * i);
    pg.fill(fc); pg.noStroke();
    pg.ellipse(0, -r * 0.52, r * 0.46, r * 0.95);
    pg.fill(red(bc), green(bc), blue(bc), 100);
    pg.ellipse(0, -r * 0.52, r * 0.24, r * 0.66);
    pg.pop();
  }
  pg.pop();

  pg.fill(fc); pg.circle(0, 0, r * 0.38);
  pg.fill(bc); pg.circle(0, 0, r * 0.25);
  pg.fill(fc); pg.circle(0, 0, r * 0.1);
  pg.pop();
}
