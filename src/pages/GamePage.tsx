import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const CANVAS_W = 480;
const CANVAS_H = 320;
const WORLD_W = 3200;
const TILE = 32;
const GROUND_Y = 272;
const GRAVITY = 0.5;

interface Rect { x: number; y: number; width: number; height: number; }
interface Block extends Rect { type: 'ground'|'brick'|'question'|'pipe'; hit: boolean; coins: number; powerup?: 'life'; }
interface Powerup extends Rect { vx: number; vy: number; alive: boolean; }
interface Enemy extends Rect { vx: number; vy: number; alive: boolean; squished: boolean; timer: number; }
interface Coin extends Rect { collected: boolean; }

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<'start'|'playing'|'gameover'|'win'>('start');
  const [displayState, setDisplayState] = useState<'start'|'playing'|'gameover'|'win'>('start');
  const [score, setScore] = useState(0);
  const keysRef = useRef<Record<string,boolean>>({});
  const touchRef = useRef({ left: false, right: false, jump: false });
  const restartRef = useRef<() => void>(() => {});

  const { user } = useAuth();

  type HighScore = { name: string; score: number; date: string };
  const [highScores, setHighScores] = useState<HighScore[]>(() => {
    try { return JSON.parse(localStorage.getItem('excavatorGameScores') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    if (displayState === 'gameover' || displayState === 'win') {
      const name = user?.name || user?.username || 'Unknown';
      const entry: HighScore = { name, score, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) };
      const updated = [...highScores, entry].sort((a, b) => b.score - a.score).slice(0, 10);
      setHighScores(updated);
      localStorage.setItem('excavatorGameScores', JSON.stringify(updated));
    }
  }, [displayState]);

  const clearScores = () => {
    setHighScores([]);
    localStorage.removeItem('excavatorGameScores');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;

    let scoreVal = 0;
    let lives = 3;
    let coinCount = 0;
    let cameraX = 0;
    let frame = 0;
    let animId: number;
    let invincible = 0;

    const player = { x: 80, y: GROUND_Y - 40, width: 28, height: 36, vx: 0, vy: 0, grounded: false, facing: 1 };

    const buildLevel = () => {
      const grounds: Block[] = [];
      for (let i = 0; i < WORLD_W / TILE; i++) {
        if ((i >= 50 && i <= 52) || (i >= 68 && i <= 70)) continue;
        grounds.push({ x: i * TILE, y: GROUND_Y, width: TILE, height: TILE * 2, type: 'ground', hit: false, coins: 0 });
      }
      const questions: Block[] = [
        { x: 5*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 8*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 1 },
        { x: 8*TILE,  y: GROUND_Y - 9*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 20*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'life' },
        { x: 35*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 60*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'life' },
        { x: 78*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'life' },
      ];
      const bricks: Block[] = [
        { x: 6*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 7*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 11*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 12*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 30*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 31*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 32*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 45*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 46*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 47*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
      ];
      const pipes: Block[] = [
        { x: 16*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 26*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 57*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 65*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 88*TILE, y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
      ];
      const floatCoins: Coin[] = [
        { x: 9*TILE+8,  y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 21*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 22*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 33*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 40*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 41*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 73*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 74*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 75*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
      ];
      const enemies: Enemy[] = [
        { x: 19*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 23*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 36*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 40*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 55*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 62*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 73*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 80*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 81*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
      ];
      const powerupItems: Powerup[] = [];
      return { grounds, questions, bricks, pipes, floatCoins, enemies, powerupItems };
    };

    let level = buildLevel();
    let coinPops: { x: number; y: number; vy: number; vx: number; life: number; max: number; }[] = [];

    const clouds = [
      { x: 80,   y: 30,  w: 80,  h: 35 },
      { x: 320,  y: 50,  w: 100, h: 45 },
      { x: 640,  y: 25,  w: 90,  h: 38 },
      { x: 960,  y: 45,  w: 110, h: 48 },
      { x: 1280, y: 30,  w: 85,  h: 36 },
      { x: 1600, y: 52,  w: 100, h: 42 },
      { x: 1920, y: 35,  w: 90,  h: 40 },
      { x: 2240, y: 60,  w: 120, h: 50 },
      { x: 2560, y: 28,  w: 80,  h: 34 },
      { x: 2880, y: 48,  w: 95,  h: 42 },
    ];
    const hills = [
      { x: 0,    r: 110 }, { x: 380,  r: 75  }, { x: 700,  r: 95  },
      { x: 1050, r: 130 }, { x: 1450, r: 85  }, { x: 1900, r: 100 },
      { x: 2350, r: 90  }, { x: 2800, r: 115 },
    ];
    const flagX = 92 * TILE;
    const flagH = TILE * 8;

    const resetPlayer = () => {
      player.x = 80; player.y = GROUND_Y - 40;
      player.vx = 0; player.vy = 0;
      player.grounded = false;
      cameraX = 0;
      invincible = 120;
    };

    const allSolids = () => [
      ...level.grounds,
      ...level.questions,
      ...level.bricks,
      ...level.pipes,
    ];

    // ---- Draw helpers ----
    const drawCloud = (x: number, y: number, w: number, h: number) => {
      const sx = x - cameraX;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.beginPath();
      ctx.ellipse(sx + w*0.3, y - h*0.2, w*0.3, h*0.35, 0, 0, Math.PI*2);
      ctx.ellipse(sx + w*0.5, y - h*0.5, w*0.38, h*0.5, 0, 0, Math.PI*2);
      ctx.ellipse(sx + w*0.7, y - h*0.2, w*0.3, h*0.35, 0, 0, Math.PI*2);
      ctx.fill();
    };

    const drawGroundBlock = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(sx, b.y, b.width, 6);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(sx, b.y + 6, b.width, b.height - 6);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(sx, b.y + 6, b.width, b.height - 6);
    };

    const drawQuestionBlock = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      if (b.hit) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(sx, b.y, b.width, b.height);
        ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
        ctx.strokeRect(sx, b.y, b.width, b.height);
        return;
      }
      const shimmer = Math.sin(frame * 0.15) * 20;
      ctx.fillStyle = `hsl(45,100%,${55 + shimmer}%)`;
      ctx.fillRect(sx, b.y, b.width, b.height);
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 2;
      ctx.strokeRect(sx, b.y, b.width, b.height);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 18px serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', sx + b.width / 2, b.y + b.height - 7);
    };

    const drawBrickBlock = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      ctx.fillStyle = b.hit ? '#78350f' : '#b45309';
      ctx.fillRect(sx, b.y, b.width, b.height);
      ctx.strokeStyle = '#92400e'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, b.y + b.height / 2); ctx.lineTo(sx + b.width, b.y + b.height / 2);
      ctx.moveTo(sx + b.width / 2, b.y); ctx.lineTo(sx + b.width / 2, b.y + b.height / 2);
      ctx.moveTo(sx + b.width * 0.25, b.y + b.height / 2); ctx.lineTo(sx + b.width * 0.25, b.y + b.height);
      ctx.moveTo(sx + b.width * 0.75, b.y + b.height / 2); ctx.lineTo(sx + b.width * 0.75, b.y + b.height);
      ctx.stroke();
    };

    const drawPipe = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(sx + 3, b.y + TILE, b.width - 6, b.height - TILE);
      ctx.fillStyle = '#15803d';
      ctx.fillRect(sx - 3, b.y, b.width + 6, TILE);
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(sx + 7, b.y + 3, 5, b.height - 6);
    };

    const drawLaborer = (e: Enemy) => {
      const sx = e.x - cameraX;
      if (sx + e.width < 0 || sx > CANVAS_W) return;
      if (e.squished) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx, e.y + e.height - 5, e.width, 5);
        ctx.fillStyle = '#f97316';
        ctx.fillRect(sx + 3, e.y + e.height - 4, e.width - 6, 3);
        return;
      }
      const walk = Math.sin(frame * 0.22) * 3;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(sx + 3,            e.y + e.height - 5, 9, 5);
      ctx.fillRect(sx + e.width - 12, e.y + e.height - 5, 9, 5);
      ctx.fillStyle = '#374151';
      ctx.fillRect(sx + 5, e.y + e.height * 0.58, e.width - 10, e.height * 0.32);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(sx + e.width / 2 - 1, e.y + e.height * 0.58, 2, e.height * 0.32);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(sx,              e.y + e.height * 0.36 + walk, 4, e.height * 0.22);
      ctx.fillRect(sx + e.width - 4, e.y + e.height * 0.36 - walk, 4, e.height * 0.22);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(sx + 4, e.y + e.height * 0.33, e.width - 8, e.height * 0.27);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(sx + 4, e.y + e.height * 0.39, e.width - 8, 2);
      ctx.fillRect(sx + 4, e.y + e.height * 0.47, e.width - 8, 2);
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(sx + e.width / 2, e.y + e.height * 0.21, e.width / 2 - 5, e.height * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(sx + e.width / 2 - 6, e.y + e.height * 0.16, 3, 3);
      ctx.fillRect(sx + e.width / 2 + 3, e.y + e.height * 0.16, 3, 3);
      ctx.fillStyle = '#92400e';
      ctx.fillRect(sx + e.width / 2 - 3, e.y + e.height * 0.24, 6, 1.5);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(sx + 1, e.y + e.height * 0.08, e.width - 2, e.height * 0.07);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(sx + e.width / 2, e.y + e.height * 0.07, e.width / 2 - 3, e.height * 0.1, 0, Math.PI, 0);
      ctx.fill();
    };

    const drawLifePowerup = (p: Powerup) => {
      const sx = p.x - cameraX;
      if (sx + p.width < 0 || sx > CANVAS_W) return;
      const f = p.vx >= 0 ? 1 : -1;
      const bob = Math.sin(frame * 0.2) * 1.5;
      ctx.fillStyle = '#166534';
      ctx.fillRect(sx - 2, p.y + p.height * 0.74, p.width + 4, 7);
      ctx.fillStyle = '#14532d';
      ctx.beginPath(); ctx.arc(sx,           p.y + p.height * 0.8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + p.width, p.y + p.height * 0.8, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(sx + 1, p.y + p.height * 0.33, p.width - 2, p.height * 0.43);
      const cabX = f === 1 ? sx : sx + p.width - 11;
      ctx.fillStyle = '#15803d';
      ctx.fillRect(cabX, p.y + p.height * 0.1, 11, p.height * 0.25);
      ctx.fillStyle = '#86efac';
      ctx.fillRect(cabX + 1, p.y + p.height * 0.13, 8, p.height * 0.15);
      const boomX = f === 1 ? sx + p.width - 2 : sx + 2;
      ctx.strokeStyle = '#14532d'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(boomX, p.y + p.height * 0.4 + bob);
      ctx.lineTo(boomX + f * 12, p.y + p.height * 0.25 + bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(boomX + f * 12, p.y + p.height * 0.25 + bob);
      ctx.lineTo(boomX + f * 18, p.y + p.height * 0.45 + bob);
      ctx.stroke();
      ctx.fillStyle = '#14532d';
      ctx.fillRect(boomX + f * 14, p.y + p.height * 0.45 + bob, f > 0 ? 7 : -7, 5);
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', sx + p.width / 2, p.y - 3);
    };

    const drawPlayer = () => {
      const sx = player.x - cameraX;
      const f = player.facing; // 1=right, -1=left
      const armBob = player.grounded ? Math.sin(frame * 0.18) * 2 : 0;

      // === Tracks ===
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(sx - 4, player.y + player.height * 0.72, player.width + 8, 11);
      ctx.fillStyle = '#374151';
      ctx.fillRect(sx - 4, player.y + player.height * 0.72, player.width + 8, 4);
      // Sprocket wheels
      ctx.fillStyle = '#4b5563';
      ctx.beginPath(); ctx.arc(sx,                      player.y + player.height * 0.79, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + player.width,       player.y + player.height * 0.79, 6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + player.width / 2,   player.y + player.height * 0.79, 4, 0, Math.PI * 2); ctx.fill();
      // Track bolts
      ctx.fillStyle = '#6b7280';
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(sx - 2 + i * 8, player.y + player.height * 0.75, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // === Body / Superstructure ===
      ctx.fillStyle = '#eab308';
      ctx.fillRect(sx + 1, player.y + player.height * 0.32, player.width - 2, player.height * 0.42);
      // Body shading
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(sx + 1, player.y + player.height * 0.32, 3, player.height * 0.42);

      // === Cab (opposite side from arm) ===
      const cabX = f === 1 ? sx : sx + player.width - 16;
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(cabX, player.y + player.height * 0.08, 16, player.height * 0.26);
      // Cab roof slope
      ctx.fillStyle = '#a16207';
      ctx.fillRect(cabX, player.y + player.height * 0.08, 16, 3);
      // Window
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(cabX + 2, player.y + player.height * 0.12, 12, player.height * 0.16);
      // Window glare
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(cabX + 3, player.y + player.height * 0.13, 4, 3);

      // === Boom Arm ===
      const boomX = f === 1 ? sx + player.width - 3 : sx + 3;
      const boomY = player.y + player.height * 0.38 + armBob;
      const boomEndX = boomX + f * 18;
      const boomEndY = boomY - 6 + armBob;
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(boomX, boomY);
      ctx.lineTo(boomEndX, boomEndY);
      ctx.stroke();

      // === Stick / Dipper ===
      const stickEndX = boomEndX + f * 10;
      const stickEndY = boomEndY + 12 - armBob;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(boomEndX, boomEndY);
      ctx.lineTo(stickEndX, stickEndY);
      ctx.stroke();

      // === Bucket ===
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#451a03';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (f === 1) {
        ctx.moveTo(stickEndX - 5, stickEndY - 3);
        ctx.lineTo(stickEndX + 7, stickEndY - 3);
        ctx.lineTo(stickEndX + 10, stickEndY + 7);
        ctx.lineTo(stickEndX - 3, stickEndY + 7);
      } else {
        ctx.moveTo(stickEndX + 5, stickEndY - 3);
        ctx.lineTo(stickEndX - 7, stickEndY - 3);
        ctx.lineTo(stickEndX - 10, stickEndY + 7);
        ctx.lineTo(stickEndX + 3, stickEndY + 7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Bucket teeth
      ctx.fillStyle = '#451a03';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(stickEndX + f * (-3 + i * 4), stickEndY + 7, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawCoin = (c: Coin) => {
      if (c.collected) return;
      const sx = c.x - cameraX;
      if (sx + c.width < 0 || sx > CANVAS_W) return;
      const bob = Math.sin(frame * 0.1 + c.x * 0.05) * 2;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.ellipse(sx + c.width / 2, c.y + c.height / 2 + bob, c.width / 2, c.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    const drawFlag = () => {
      const sx = flagX - cameraX;
      if (sx + 30 < 0 || sx > CANVAS_W) return;
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(sx + 3, GROUND_Y - flagH, 4, flagH);
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(sx + 7, GROUND_Y - flagH + 2);
      ctx.lineTo(sx + 28, GROUND_Y - flagH + 14);
      ctx.lineTo(sx + 7, GROUND_Y - flagH + 26);
      ctx.fill();
    };

    const drawHUD = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, CANVAS_W, 30);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`EXCAVATOR  ${String(scoreVal).padStart(6, '0')}`, 8, 20);
      ctx.textAlign = 'center';
      ctx.fillText(`RAISES: ${String(coinCount).padStart(2, '0')}`, CANVAS_W / 2, 20);
      ctx.textAlign = 'right';
      ctx.fillText(`LIVES: ${lives}`, CANVAS_W - 8, 20);
    };

    const drawSplashScreen = (title: string, sub: string, titleColor: string) => {
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (const h of hills) {
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(h.x - cameraX, GROUND_Y, h.r, Math.PI, 0);
        ctx.fill();
      }
      ctx.fillStyle = titleColor;
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 44);
      ctx.fillStyle = '#fff';
      ctx.font = '15px monospace';
      ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 2);
      ctx.fillText('Press SPACE or tap JUMP', CANVAS_W / 2, CANVAS_H / 2 + 26);
      if (scoreVal > 0) ctx.fillText(`Score: ${scoreVal}`, CANVAS_W / 2, CANVAS_H / 2 + 52);
    };

    // ---- Keyboard ----
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      if ([' ','Enter'].includes(e.key)) {
        if (gsRef.current === 'start') { gsRef.current = 'playing'; setDisplayState('playing'); }
        if (gsRef.current === 'gameover' || gsRef.current === 'win') restart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const restart = () => {
      scoreVal = 0; lives = 3; coinCount = 0;
      setScore(0);
      level = buildLevel();
      resetPlayer();
      invincible = 0;
      coinPops = [];
      gsRef.current = 'playing';
      setDisplayState('playing');
    };
    restartRef.current = restart;

    // ---- Main loop ----
    const loop = () => {
      animId = requestAnimationFrame(loop);
      frame++;
      const gs = gsRef.current;

      if (gs === 'start')    { drawSplashScreen('EXCAVATOR GAME', 'Arrow/WASD to move, Space to jump', '#fbbf24'); return; }
      if (gs === 'gameover') { drawSplashScreen('GAME OVER', 'You ran out of lives!', '#dc2626'); return; }
      if (gs === 'win')      { drawSplashScreen('Congratulations!', 'Now get back to work!', '#4ade80'); return; }

      // Input
      const k = keysRef.current;
      const t = touchRef.current;
      if (k['ArrowLeft']  || k['a'] || k['A'] || t.left)  { player.vx = Math.max(player.vx - 0.9, -5); player.facing = -1; }
      else if (k['ArrowRight'] || k['d'] || k['D'] || t.right) { player.vx = Math.min(player.vx + 0.9, 5);  player.facing = 1;  }
      else { player.vx *= 0.82; }

      if ((k['ArrowUp'] || k['w'] || k['W'] || k[' '] || t.jump) && player.grounded) {
        player.vy = -12;
        player.grounded = false;
        if (t.jump) touchRef.current.jump = false;
      }

      player.vy = Math.min(player.vy + GRAVITY, 15);
      player.x += player.vx;
      player.y += player.vy;
      if (player.x < 0) player.x = 0;

      // Solid collisions
      player.grounded = false;
      for (const b of allSolids()) {
        if (!overlap(player, b)) continue;
        const ox = Math.min(player.x + player.width - b.x, b.x + b.width - player.x);
        const oy = Math.min(player.y + player.height - b.y, b.y + b.height - player.y);
        if (oy <= ox) {
          if (player.vy >= 0 && player.y + player.height - player.vy <= b.y + 4) {
            player.y = b.y - player.height;
            player.vy = 0;
            player.grounded = true;
          } else if (player.vy < 0 && player.y - player.vy >= b.y + b.height - 4) {
            player.y = b.y + b.height;
            player.vy = 1;
            if ((b.type === 'question') && !b.hit) {
              b.hit = true;
              if (b.powerup === 'life') {
                level.powerupItems.push({ x: b.x + 4, y: b.y - TILE, width: 24, height: 24, vx: 1.5, vy: -3, alive: true });
              } else {
                coinCount += b.coins; scoreVal += b.coins * 100;
                setScore(s => s + b.coins * 100);
                for (let ci = 0; ci < b.coins; ci++) {
                  coinPops.push({ x: b.x + b.width / 2, y: b.y - 4, vy: -5 - ci * 1.8, vx: (ci % 2 === 0 ? 0.5 : -0.5), life: 50, max: 50 });
                }
              }
            } else if (b.type === 'brick' && !b.hit) {
              b.hit = true; scoreVal += 50;
              setScore(s => s + 50);
              coinPops.push({ x: b.x + b.width / 2, y: b.y - 4, vy: -4, vx: 0, life: 35, max: 35 });
            }
          }
        } else {
          if (player.x + player.width - player.vx <= b.x + 3) { player.x = b.x - player.width; player.vx = 0; }
          else if (player.x - player.vx >= b.x + b.width - 3) { player.x = b.x + b.width; player.vx = 0; }
        }
      }

      // Powerup items (life excavators)
      for (const p of level.powerupItems) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.vy += GRAVITY;
        p.y += p.vy;
        for (const b of level.grounds) {
          if (overlap(p, b) && p.vy >= 0) { p.y = b.y - p.height; p.vy = 0; }
        }
        for (const b of level.pipes) {
          if (overlap(p, b)) {
            p.vx *= -1;
            p.x += p.vx > 0 ? b.x + b.width - p.x : b.x - p.x - p.width;
          }
        }
        if (overlap(player, p)) {
          p.alive = false;
          lives = Math.min(lives + 1, 9);
          scoreVal += 500; setScore(s => s + 500);
          coinPops.push({ x: p.x + p.width / 2, y: p.y, vy: -5, vx: 0, life: 50, max: 50 });
        }
      }

      // Coin pop particles
      coinPops = coinPops.filter(p => p.life > 0);
      for (const p of coinPops) { p.y += p.vy; p.x += p.vx; p.vy += 0.25; p.life--; }

      // Floating coins
      for (const c of level.floatCoins) {
        if (!c.collected && overlap(player, c)) {
          c.collected = true; coinCount++; scoreVal += 100;
          setScore(s => s + 100);
        }
      }

      // Enemies
      for (const e of level.enemies) {
        if (!e.alive) continue;
        if (e.squished) { if (--e.timer <= 0) e.alive = false; continue; }
        e.x += e.vx;
        e.vy += GRAVITY;
        e.y += e.vy;

        // Vertical collision - ground only
        for (const b of level.grounds) {
          if (overlap(e, b) && e.vy >= 0) { e.y = b.y - e.height; e.vy = 0; }
        }

        // Horizontal collision with pipes - block and reverse (only flip once)
        let hitPipe = false;
        for (const b of level.pipes) {
          if (overlap(e, b)) {
            if (e.vx > 0) { e.x = b.x - e.width; }
            else { e.x = b.x + b.width; }
            e.vx *= -1;
            hitPipe = true;
            break;
          }
        }

        // Turn around at ground edges (lookahead - only if no pipe already handled it)
        if (!hitPipe) {
          const lookX = e.vx > 0 ? e.x + e.width + 2 : e.x - 2;
          const groundAhead = level.grounds.some(b =>
            lookX >= b.x && lookX < b.x + b.width && Math.abs(e.y + e.height - b.y) < 6
          );
          if (!groundAhead) e.vx *= -1;
        }

        if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); }

        if (overlap(player, e)) {
          const prevBottom = player.y + player.height - player.vy;
          if (player.vy > 0 && prevBottom <= e.y + 6) {
            e.squished = true; e.timer = 28;
            player.vy = -8; scoreVal += 200;
            setScore(s => s + 200);
          } else if (invincible <= 0) {
            lives--;
            setScore(s => s);
            if (lives <= 0) { gsRef.current = 'gameover'; setDisplayState('gameover'); }
            else resetPlayer();
          }
        }
      }

      // Camera
      cameraX = Math.max(0, Math.min(player.x - CANVAS_W / 3, WORLD_W - CANVAS_W));

      // Fall
      if (player.y > CANVAS_H + 80 && invincible <= 0) {
        lives--;
        if (lives <= 0) { gsRef.current = 'gameover'; setDisplayState('gameover'); }
        else resetPlayer();
      }

      if (invincible > 0) invincible--;

      // Flag / win
      if (player.x + player.width >= flagX && player.x <= flagX + 10) {
        scoreVal += 1000; setScore(s => s + 1000);
        gsRef.current = 'win'; setDisplayState('win');
      }

      // Draw
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (const h of hills) {
        const hsx = h.x - cameraX;
        if (hsx + h.r * 2 < 0 || hsx - h.r > CANVAS_W) continue;
        ctx.fillStyle = '#4ade80';
        ctx.beginPath(); ctx.arc(hsx, GROUND_Y, h.r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#86efac';
        ctx.beginPath(); ctx.arc(hsx - 18, GROUND_Y - h.r * 0.5, h.r * 0.28, Math.PI, 0); ctx.fill();
      }
      for (const cl of clouds) drawCloud(cl.x, cl.y, cl.w, cl.h);
      for (const b of level.grounds)   drawGroundBlock(b);
      for (const b of level.bricks)    drawBrickBlock(b);
      for (const b of level.questions) drawQuestionBlock(b);
      for (const b of level.pipes)     drawPipe(b);
      for (const c of level.floatCoins) drawCoin(c);
      drawFlag();
      for (const e of level.enemies) if (e.alive) drawLaborer(e);
      for (const p of level.powerupItems) if (p.alive) drawLifePowerup(p);
      // Flash player when invincible
      if (invincible <= 0 || Math.floor(invincible / 6) % 2 === 0) drawPlayer();

      // Draw coin pop particles
      for (const p of coinPops) {
        const px = p.x - cameraX;
        const alpha = Math.min(1, p.life / (p.max * 0.4));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, p.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#92400e';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', px, p.y + 2.5);
        ctx.globalAlpha = 1;
      }

      drawHUD();
    };

    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  return (
    <div className="min-h-screen bg-blue-900 dark:bg-black text-white px-2 sm:px-4 py-2 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-2xl mx-auto">
        <div className="bg-blue-800 dark:bg-black border-2 border-yellow-400 rounded-lg shadow-2xl p-3">
          <h1 className="text-xl font-bold text-yellow-400 mb-2 text-center font-mono tracking-widest">EXCAVATOR GAME</h1>

          <div className="flex justify-center mb-3">
            <canvas
              ref={canvasRef}
              className="border-4 border-yellow-400 rounded-lg max-w-full"
              style={{ width: '100%', height: 'auto', aspectRatio: '3/2', imageRendering: 'pixelated' }}
            />
          </div>

          {/* Score display for mobile */}
          <div className="flex justify-between text-yellow-300 font-mono text-sm mb-2 px-1">
            <span>SCORE: {String(score).padStart(6, '0')}</span>
            <span>STATE: {displayState.toUpperCase()}</span>
          </div>

          {/* Touch Controls */}
          <div className="select-none">
            <div className="flex justify-between items-end px-2 pb-1">
              <div className="flex gap-3">
                <button
                  onTouchStart={(e) => { e.preventDefault(); touchRef.current.left = true; }}
                  onTouchEnd={(e)   => { e.preventDefault(); touchRef.current.left = false; }}
                  onMouseDown={() => { touchRef.current.left = true; }}
                  onMouseUp={()    => { touchRef.current.left = false; }}
                  onMouseLeave={()  => { touchRef.current.left = false; }}
                  className="w-14 h-14 bg-gray-700 border-2 border-gray-400 rounded-xl flex items-center justify-center text-white text-2xl font-bold active:bg-gray-500 touch-none shadow-lg"
                >◀</button>
                <button
                  onTouchStart={(e) => { e.preventDefault(); touchRef.current.right = true; }}
                  onTouchEnd={(e)   => { e.preventDefault(); touchRef.current.right = false; }}
                  onMouseDown={() => { touchRef.current.right = true; }}
                  onMouseUp={()    => { touchRef.current.right = false; }}
                  onMouseLeave={()  => { touchRef.current.right = false; }}
                  className="w-14 h-14 bg-gray-700 border-2 border-gray-400 rounded-xl flex items-center justify-center text-white text-2xl font-bold active:bg-gray-500 touch-none shadow-lg"
                >▶</button>
              </div>
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  touchRef.current.jump = true;
                  if (gsRef.current !== 'playing') {
                    if (gsRef.current === 'start') { gsRef.current = 'playing'; setDisplayState('playing'); }
                    else { restartRef.current(); }
                  }
                }}
                onTouchEnd={(e)   => { e.preventDefault(); touchRef.current.jump = false; }}
                onMouseDown={() => { touchRef.current.jump = true; }}
                onMouseUp={()    => { touchRef.current.jump = false; }}
                onMouseLeave={()  => { touchRef.current.jump = false; }}
                className="w-16 h-16 bg-red-600 border-2 border-red-300 rounded-full flex items-center justify-center text-white font-bold text-base active:bg-red-400 touch-none shadow-lg"
              >JUMP</button>
            </div>
          </div>

          <p className="text-center text-blue-300 text-xs mt-2 hidden lg:block">
            Arrow keys / WASD = move &nbsp;|&nbsp; Space = jump &nbsp;|&nbsp; Stomp enemies &nbsp;|&nbsp; Hit ? blocks &nbsp;|&nbsp; Reach the flag!
          </p>
        </div>

        {/* High Scores Leaderboard */}
        <div className="mt-3 bg-blue-800 dark:bg-gray-900 border-2 border-yellow-400 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-yellow-400 font-mono font-bold text-sm flex items-center gap-2">
              <Trophy size={16} /> HIGH SCORES
            </h2>
            {highScores.length > 0 && (
              <button onClick={clearScores} className="text-gray-400 hover:text-red-400 text-xs font-mono">CLEAR</button>
            )}
          </div>
          {highScores.length === 0 ? (
            <p className="text-gray-400 font-mono text-xs text-center py-2">No scores yet — play to set a record!</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-yellow-500 border-b border-yellow-700">
                  <th className="text-left pb-1 w-6">#</th>
                  <th className="text-left pb-1">NAME</th>
                  <th className="text-right pb-1">SCORE</th>
                  <th className="text-right pb-1 hidden sm:table-cell">DATE</th>
                </tr>
              </thead>
              <tbody>
                {highScores.map((s, i) => (
                  <tr key={i} className={`${i === 0 ? 'text-yellow-300' : 'text-gray-300'} border-b border-blue-700`}>
                    <td className="py-1">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</td>
                    <td className="py-1 truncate max-w-0" style={{ maxWidth: '120px' }}>{s.name}</td>
                    <td className="py-1 text-right">{s.score.toLocaleString()}</td>
                    <td className="py-1 text-right text-gray-500 hidden sm:table-cell">{s.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
