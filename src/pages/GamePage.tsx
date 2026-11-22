import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { saveGameScore, getTopGameScores, clearAllGameScores, GameScore } from '../services/gameScoreService';

const CANVAS_W = 480;
const CANVAS_H = 320;
const WORLD_W = 9600;
const TILE = 32;
const GROUND_Y = 272;
const GRAVITY = 0.5;

interface Rect { x: number; y: number; width: number; height: number; }
type PowerKind = 'life'|'hardhat'|'turbo'|'overtime'|'rocks';
type PipeKind = 'steam'|'coins'|'workers';
interface Block extends Rect { type: 'ground'|'brick'|'question'|'pipe'; hit: boolean; coins: number; powerup?: PowerKind; pipe?: PipeKind; timer?: number; }
interface Powerup extends Rect { vx: number; vy: number; alive: boolean; kind: PowerKind; }
interface Enemy extends Rect { vx: number; vy: number; alive: boolean; squished: boolean; timer: number; from?: Block; emerging?: number; walk?: number; }
interface Coin extends Rect { collected: boolean; }
interface Particle extends Rect { vx: number; vy: number; life: number; }

const STEAM_CYCLE = 240;
const STEAM_WARN = 150;
const STEAM_ON = 190;
const TURBO_FRAMES = 600;
const OVERTIME_FRAMES = 480;
const POWER_LABEL: Record<PowerKind, string> = {
  life: '+1 LIFE', hardhat: 'HARD HAT: BLOCKS 1 HIT', turbo: 'DIESEL TURBO!', overtime: 'OVERTIME! UNSTOPPABLE', rocks: 'ROCK BUCKET: F / X TO THROW',
};

const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

export default function GamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef = useRef<'start'|'briefing'|'playing'|'gameover'|'win'>('start');
  const [displayState, setDisplayState] = useState<'start'|'briefing'|'playing'|'gameover'|'win'>('start');
  const [score, setScore] = useState(0);
  const keysRef = useRef<Record<string,boolean>>({});
  const touchRef = useRef({ left: false, right: false, jump: false, throw: false });
  const restartRef = useRef<() => void>(() => {});
  const briefingFrameRef = useRef(0);
  const briefingTextDoneRef = useRef(false);
  const dialogueIndexRef = useRef(0);
  const dialogueLineFrameRef = useRef(0);

  const { user } = useAuth();
  const userNameRef = useRef('OPERATOR');
  useEffect(() => { userNameRef.current = (user?.name || user?.username || 'OPERATOR').substring(0, 16).toUpperCase(); }, [user]);

  const [highScores, setHighScores] = useState<GameScore[]>([]);
  const [scoresLoading, setScoresLoading] = useState(true);

  useEffect(() => {
    getTopGameScores(10).then(s => { setHighScores(s); setScoresLoading(false); }).catch(() => setScoresLoading(false));
  }, []);

  useEffect(() => {
    if (displayState === 'gameover' || displayState === 'win') {
      const name = user?.name || user?.username || 'Unknown';
      const entry = { name, score, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) };
      saveGameScore(entry).then(() => getTopGameScores(10).then(setHighScores)).catch(console.error);
    }
  }, [displayState]);

  const clearScores = () => {
    clearAllGameScores().then(() => setHighScores([])).catch(console.error);
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
    let stage = 1;
    let stageBanner = 0;
    let hardhat = false;
    let hasRocks = false;
    let turbo = 0;
    let overtime = 0;
    let rockCooldown = 0;
    let rocks: Particle[] = [];
    let looseCoins: Particle[] = [];
    let toast = { text: '', t: 0 };

    const player = { x: 80, y: GROUND_Y - 40, width: 28, height: 36, vx: 0, vy: 0, grounded: false, facing: 1 };

    const buildLevel = () => {
      const grounds: Block[] = [];
      for (let i = 0; i < WORLD_W / TILE; i++) {
        if ((i >= 50 && i <= 52) || (i >= 68 && i <= 70) ||
            (i >= 115 && i <= 117) || (i >= 138 && i <= 141) ||
            (i >= 163 && i <= 165) || (i >= 188 && i <= 191) ||
            (i >= 213 && i <= 215) || (i >= 240 && i <= 243) ||
            (i >= 263 && i <= 266) || (i >= 282 && i <= 285)) continue;
        grounds.push({ x: i * TILE, y: GROUND_Y, width: TILE, height: TILE * 2, type: 'ground', hit: false, coins: 0 });
      }
      const questions: Block[] = [
        { x: 5*TILE,   y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 8*TILE,   y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 1 },
        { x: 8*TILE,   y: GROUND_Y - 9*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 20*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'hardhat' },
        { x: 35*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 60*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'turbo' },
        { x: 78*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'life' },
        // Section 2 (tiles 100-199)
        { x: 107*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 108*TILE, y: GROUND_Y - 9*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 120*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'rocks' },
        { x: 135*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 150*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 1 },
        { x: 163*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'overtime' },
        { x: 178*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 178*TILE, y: GROUND_Y - 9*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 192*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 1 },
        // Section 3 (tiles 200-290)
        { x: 205*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'life' },
        { x: 218*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 218*TILE, y: GROUND_Y - 9*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 233*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
        { x: 248*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'hardhat' },
        { x: 261*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 3 },
        { x: 275*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 0, powerup: 'rocks' },
        { x: 288*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'question', hit: false, coins: 2 },
      ];
      const bricks: Block[] = [
        { x: 6*TILE,   y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 7*TILE,   y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 11*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 12*TILE,  y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 30*TILE,  y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 31*TILE,  y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 32*TILE,  y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 45*TILE,  y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 46*TILE,  y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 47*TILE,  y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        // Section 2
        { x: 106*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 109*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 110*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 125*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 126*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 127*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 143*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 144*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 155*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 156*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 170*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 171*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 172*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 185*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 186*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        // Section 3
        { x: 208*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 209*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 222*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 223*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 224*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 237*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 238*TILE, y: GROUND_Y - 3*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 253*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 254*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 268*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 269*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 270*TILE, y: GROUND_Y - 4*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 280*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
        { x: 281*TILE, y: GROUND_Y - 5*TILE, width: TILE, height: TILE, type: 'brick', hit: false, coins: 0 },
      ];
      const pipes: Block[] = [
        { x: 16*TILE,  y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 26*TILE,  y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 57*TILE,  y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 65*TILE,  y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 88*TILE,  y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
        // Section 2
        { x: 103*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 113*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 130*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 145*TILE, y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
        { x: 158*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 175*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 190*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 198*TILE, y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
        // Section 3
        { x: 212*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 228*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 244*TILE, y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
        { x: 258*TILE, y: GROUND_Y - 3*TILE, width: TILE*2, height: TILE*3, type: 'pipe', hit: false, coins: 0 },
        { x: 272*TILE, y: GROUND_Y - 2*TILE, width: TILE*2, height: TILE*2, type: 'pipe', hit: false, coins: 0 },
        { x: 278*TILE, y: GROUND_Y - 5*TILE, width: TILE*2, height: TILE*5, type: 'pipe', hit: false, coins: 0 },
        { x: 287*TILE, y: GROUND_Y - 4*TILE, width: TILE*2, height: TILE*4, type: 'pipe', hit: false, coins: 0 },
      ];
      const pipeKinds: Record<number, PipeKind> = {
        16: 'coins', 57: 'workers', 88: 'steam', 103: 'coins', 113: 'workers', 145: 'steam', 175: 'workers',
        190: 'coins', 198: 'steam', 212: 'workers', 228: 'coins', 244: 'steam', 258: 'workers', 278: 'steam',
      };
      pipes.forEach((b, i) => { b.pipe = pipeKinds[b.x / TILE]; b.timer = (i * 53) % STEAM_CYCLE; });
      const floatCoins: Coin[] = [
        { x: 9*TILE+8,   y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 21*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 22*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 33*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 40*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 41*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 73*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 74*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 75*TILE+8,  y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        // Section 2
        { x: 112*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 113*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 128*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 136*TILE+8, y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 137*TILE+8, y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 152*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 153*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 168*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 183*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 184*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 195*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        // Section 3
        { x: 215*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 216*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 230*TILE+8, y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 231*TILE+8, y: GROUND_Y - 13*TILE, width: 14, height: 14, collected: false },
        { x: 246*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 260*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 261*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 274*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 275*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
        { x: 289*TILE+8, y: GROUND_Y - 9*TILE,  width: 14, height: 14, collected: false },
      ];
      const enemies: Enemy[] = [
        { x: 19*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 23*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 36*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 40*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.2, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 55*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 62*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 73*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 80*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 81*TILE,  y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        // Section 2 (slightly faster)
        { x: 105*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.3, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 112*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.3, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 120*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.3, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 133*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.4, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 134*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.4, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 148*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.4, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 160*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 172*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 173*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.5, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 185*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.6, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 196*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.6, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 197*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.6, vy: 0, alive: true, squished: false, timer: 0 },
        // Section 3 (faster still)
        { x: 207*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.7, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 215*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.7, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 225*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.8, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 226*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.8, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 238*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.8, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 250*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.9, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 251*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -1.9, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 263*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -2.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 272*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -2.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 280*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -2.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 281*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -2.0, vy: 0, alive: true, squished: false, timer: 0 },
        { x: 288*TILE, y: GROUND_Y - TILE, width: 28, height: 28, vx: -2.1, vy: 0, alive: true, squished: false, timer: 0 },
      ];
      const powerupItems: Powerup[] = [];
      return { grounds, questions, bricks, pipes, floatCoins, enemies, powerupItems };
    };

    const buildLevel2 = () => {
      const pits: [number, number][] = [
        [30, 33], [48, 51], [66, 69], [84, 88], [102, 105], [121, 124], [140, 144], [158, 161],
        [176, 180], [195, 198], [214, 218], [232, 235], [250, 254], [268, 271], [280, 283],
      ];
      const grounds: Block[] = [];
      for (let i = 0; i < WORLD_W / TILE; i++) {
        if (pits.some(([a, b]) => i >= a && i <= b)) continue;
        grounds.push({ x: i * TILE, y: GROUND_Y, width: TILE, height: TILE * 2, type: 'ground', hit: false, coins: 0 });
      }
      const block = (type: 'brick'|'question', t: number, row: number, coins = 0, powerup?: PowerKind): Block =>
        ({ x: t * TILE, y: GROUND_Y - row * TILE, width: TILE, height: TILE, type, hit: false, coins, powerup });
      const questions: Block[] = ([
        [6, 5, 2], [10, 5, 0, 'hardhat'], [20, 5, 3], [20, 9, 2], [37, 5, 0, 'rocks'], [55, 5, 3], [73, 5, 2],
        [90, 5, 0, 'life'], [109, 5, 2], [109, 9, 3], [128, 5, 0, 'turbo'], [146, 5, 3], [165, 5, 0, 'overtime'],
        [183, 5, 2], [200, 5, 3], [211, 5, 0, 'hardhat'], [229, 5, 2], [229, 9, 3], [246, 5, 0, 'life'],
        [265, 5, 0, 'rocks'], [277, 5, 3],
      ] as [number, number, number, PowerKind?][]).map(([t, row, coins, pu]) => block('question', t, row, coins, pu));
      const bricks: Block[] = ([
        [7, 5], [8, 5], [19, 5], [21, 5], [35, 3], [36, 3], [43, 4], [44, 4], [45, 4],
        [85, 3], [86, 3], [87, 3], [108, 5], [110, 5], [126, 4], [127, 4],
        [141, 3], [142, 3], [143, 3], [164, 5], [166, 5], [177, 3], [178, 3], [179, 3],
        [182, 5], [184, 5], [215, 3], [216, 3], [217, 3], [228, 5], [230, 5],
        [251, 3], [252, 3], [253, 3], [264, 5], [266, 5], [276, 5], [278, 5],
      ] as [number, number][]).map(([t, row]) => block('brick', t, row));
      const pipes: Block[] = ([
        [14, 2, 'coins'], [24, 3, 'workers'], [40, 3, 'steam'], [58, 4, 'workers'], [76, 2, 'coins'], [94, 3, 'steam'],
        [112, 4, 'workers'], [131, 3, 'steam'], [150, 2, 'coins'], [168, 4, 'workers'], [186, 3, 'steam'],
        [205, 4, 'workers'], [224, 2, 'coins'], [242, 3, 'steam'], [260, 4, 'workers'],
      ] as [number, number, PipeKind][]).map(([t, h, pipe], i) =>
        ({ x: t * TILE, y: GROUND_Y - h * TILE, width: TILE * 2, height: TILE * h, type: 'pipe', hit: false, coins: 0, pipe, timer: (i * 53) % STEAM_CYCLE }));
      const floatCoins: Coin[] = ([
        [20, 13], [31, 7], [32, 7], [49, 7], [50, 7], [67, 7], [68, 7], [86, 6], [103, 7], [104, 7],
        [122, 7], [123, 7], [142, 6], [159, 7], [160, 7], [178, 6], [196, 7], [197, 7], [216, 6],
        [233, 7], [234, 7], [252, 6], [269, 7], [270, 7], [281, 7], [282, 7],
      ] as [number, number][]).map(([t, row]) =>
        ({ x: t * TILE + 8, y: GROUND_Y - row * TILE, width: 14, height: 14, collected: false }));
      const enemies: Enemy[] = [
        19, 22, 36, 44, 45, 55, 62, 72, 80, 81, 91, 98, 108, 116, 117, 127, 135, 136, 147, 154,
        164, 172, 173, 183, 191, 192, 202, 210, 221, 228, 229, 238, 246, 247, 257, 264, 275, 276, 287, 288,
      ].map(t => ({
        x: t * TILE, y: GROUND_Y - TILE, width: 28, height: 28,
        vx: -(1.6 + Math.floor(t / 50) * 0.15), vy: 0, alive: true, squished: false, timer: 0,
      }));
      const powerupItems: Powerup[] = [];
      return { grounds, questions, bricks, pipes, floatCoins, enemies, powerupItems };
    };

    const theme = () => stage === 2
      ? { skyTop: '#1e1b4b', skyBottom: '#f97316', hill: '#365314', hillHi: '#4d7c0f', cloud: 'rgba(253,186,116,0.55)', groundTop: '#a8a29e', groundBody: '#57534e', groundLine: '#44403c' }
      : { skyTop: '#60a5fa', skyBottom: '#60a5fa', hill: '#4ade80', hillHi: '#86efac', cloud: 'rgba(255,255,255,0.92)', groundTop: '#4ade80', groundBody: '#92400e', groundLine: '#78350f' };

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
      { x: 3200, y: 32,  w: 90,  h: 38 },
      { x: 3520, y: 55,  w: 105, h: 46 },
      { x: 3840, y: 28,  w: 85,  h: 36 },
      { x: 4160, y: 50,  w: 110, h: 48 },
      { x: 4480, y: 35,  w: 95,  h: 42 },
      { x: 4800, y: 58,  w: 100, h: 44 },
      { x: 5120, y: 30,  w: 80,  h: 35 },
      { x: 5440, y: 45,  w: 115, h: 50 },
      { x: 5760, y: 25,  w: 90,  h: 38 },
      { x: 6080, y: 52,  w: 100, h: 42 },
      { x: 6400, y: 33,  w: 85,  h: 36 },
      { x: 6720, y: 48,  w: 110, h: 48 },
      { x: 7040, y: 28,  w: 95,  h: 40 },
      { x: 7360, y: 55,  w: 105, h: 46 },
      { x: 7680, y: 30,  w: 80,  h: 34 },
      { x: 8000, y: 50,  w: 100, h: 44 },
      { x: 8320, y: 35,  w: 90,  h: 38 },
      { x: 8640, y: 48,  w: 110, h: 48 },
      { x: 8960, y: 28,  w: 95,  h: 42 },
    ];
    const hills = [
      { x: 0,    r: 110 }, { x: 380,  r: 75  }, { x: 700,  r: 95  },
      { x: 1050, r: 130 }, { x: 1450, r: 85  }, { x: 1900, r: 100 },
      { x: 2350, r: 90  }, { x: 2800, r: 115 },
      { x: 3300, r: 100 }, { x: 3750, r: 80  }, { x: 4200, r: 120 },
      { x: 4650, r: 90  }, { x: 5100, r: 110 }, { x: 5550, r: 85  },
      { x: 6000, r: 130 }, { x: 6450, r: 95  }, { x: 6900, r: 100 },
      { x: 7350, r: 115 }, { x: 7800, r: 80  }, { x: 8250, r: 105 },
      { x: 8700, r: 90  }, { x: 9150, r: 120 },
    ];
    const flagX = 292 * TILE;
    const flagH = TILE * 8;

    const resetPlayer = () => {
      player.x = 80; player.y = GROUND_Y - 40;
      player.vx = 0; player.vy = 0;
      player.grounded = false;
      cameraX = 0;
      invincible = 120;
      turbo = 0; overtime = 0;
      rocks = []; looseCoins = [];
    };

    const addScore = (n: number) => { scoreVal += n; setScore(s => s + n); };
    const showToast = (text: string) => { toast = { text, t: 120 }; };
    const knockOut = (e: Enemy) => { e.squished = true; e.timer = 28; addScore(200); };

    const loseLife = () => {
      lives--;
      hardhat = false; hasRocks = false;
      if (lives <= 0) { gsRef.current = 'gameover'; setDisplayState('gameover'); }
      else resetPlayer();
    };
    const hurtPlayer = () => {
      if (invincible > 0 || overtime > 0) return;
      if (hardhat) { hardhat = false; invincible = 90; showToast('HARD HAT LOST!'); return; }
      loseLife();
    };

    const steamColumn = (b: Block): Rect => ({ x: b.x + 12, y: b.y - TILE * 3, width: b.width - 24, height: TILE * 3 });

    const allSolids = () => [
      ...level.grounds,
      ...level.questions,
      ...level.bricks,
      ...level.pipes,
    ];

    // ---- Draw helpers ----
    const drawCloud = (x: number, y: number, w: number, h: number) => {
      const sx = x - cameraX;
      ctx.fillStyle = theme().cloud;
      ctx.beginPath();
      ctx.ellipse(sx + w*0.3, y - h*0.2, w*0.3, h*0.35, 0, 0, Math.PI*2);
      ctx.ellipse(sx + w*0.5, y - h*0.5, w*0.38, h*0.5, 0, 0, Math.PI*2);
      ctx.ellipse(sx + w*0.7, y - h*0.2, w*0.3, h*0.35, 0, 0, Math.PI*2);
      ctx.fill();
    };

    const drawGroundBlock = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      const th = theme();
      ctx.fillStyle = th.groundTop;
      ctx.fillRect(sx, b.y, b.width, 6);
      ctx.fillStyle = th.groundBody;
      ctx.fillRect(sx, b.y + 6, b.width, b.height - 6);
      ctx.strokeStyle = th.groundLine;
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
      const steam = b.pipe === 'steam';
      ctx.fillStyle = steam ? '#6b7280' : '#16a34a';
      ctx.fillRect(sx + 3, b.y + TILE, b.width - 6, b.height - TILE);
      ctx.fillStyle = steam ? '#4b5563' : '#15803d';
      ctx.fillRect(sx - 3, b.y, b.width + 6, TILE);
      ctx.fillStyle = steam ? '#9ca3af' : '#4ade80';
      ctx.fillRect(sx + 7, b.y + 3, 5, b.height - 6);
      if (steam) {
        ctx.save();
        ctx.beginPath(); ctx.rect(sx - 3, b.y + TILE - 9, b.width + 6, 7); ctx.clip();
        ctx.fillStyle = '#fbbf24'; ctx.fillRect(sx - 3, b.y + TILE - 9, b.width + 6, 7);
        ctx.fillStyle = '#1f2937';
        for (let i = -1; i < b.width / 8 + 1; i++) {
          ctx.beginPath();
          ctx.moveTo(sx + i * 10, b.y + TILE - 2); ctx.lineTo(sx + i * 10 + 5, b.y + TILE - 2);
          ctx.lineTo(sx + i * 10 + 10, b.y + TILE - 9); ctx.lineTo(sx + i * 10 + 5, b.y + TILE - 9);
          ctx.fill();
        }
        ctx.restore();
      } else if (b.pipe === 'coins') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(sx - 3, b.y, b.width + 6, 4);
        ctx.fillRect(sx - 3, b.y + TILE - 4, b.width + 6, 4);
      }
    };

    const drawSteam = (b: Block) => {
      const sx = b.x - cameraX;
      if (sx + b.width < 0 || sx > CANVAS_W) return;
      const ph = (b.timer ?? 0) % STEAM_CYCLE;
      if (ph < STEAM_WARN) return;
      const cx = sx + b.width / 2;
      if (ph < STEAM_ON) {
        for (let i = 0; i < 3; i++) {
          const k = ((ph * 2 + i * 13) % 26) / 26;
          ctx.fillStyle = `rgba(229,231,235,${0.8 - k * 0.6})`;
          ctx.beginPath(); ctx.arc(cx + (i - 1) * 8, b.y - 4 - k * 18, 4 + k * 4, 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      const col = steamColumn(b);
      const grow = Math.min(1, (ph - STEAM_ON) / 8);
      const top = b.y - col.height * grow;
      for (let y = b.y - 6; y > top; y -= 10) {
        const w = col.width / 2 + Math.sin(frame * 0.5 + y * 0.3) * 5 + (b.y - y) * 0.08;
        ctx.fillStyle = 'rgba(243,244,246,0.85)';
        ctx.beginPath(); ctx.ellipse(cx, y, w, 9, 0, 0, Math.PI * 2); ctx.fill();
      }
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

    const drawPowerupItem = (p: Powerup) => {
      if (p.kind === 'life') { drawLifePowerup(p); return; }
      const sx = p.x - cameraX;
      if (sx + p.width < 0 || sx > CANVAS_W) return;
      const cx = sx + p.width / 2, cy = p.y + p.height / 2;
      if (p.kind === 'hardhat') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.ellipse(cx, cy + 6, 11, 10, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(sx - 1, cy + 5, p.width + 2, 4);
        ctx.fillStyle = '#ca8a04'; ctx.fillRect(cx - 1.5, cy - 4, 3, 10);
      } else if (p.kind === 'turbo') {
        ctx.fillStyle = '#dc2626'; ctx.fillRect(sx + 3, p.y + 3, p.width - 6, p.height - 3);
        ctx.fillStyle = '#7f1d1d'; ctx.fillRect(sx + 6, p.y, 7, 4);
        ctx.fillStyle = '#fde047';
        ctx.beginPath();
        ctx.moveTo(cx + 2, p.y + 6); ctx.lineTo(cx - 5, cy + 2); ctx.lineTo(cx, cy + 2);
        ctx.lineTo(cx - 2, p.y + p.height - 3); ctx.lineTo(cx + 5, cy - 1); ctx.lineTo(cx, cy - 1);
        ctx.closePath(); ctx.fill();
      } else if (p.kind === 'overtime') {
        ctx.fillStyle = `hsl(${(frame * 8) % 360},100%,60%)`;
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? 13 : 6, a = -Math.PI / 2 + i * Math.PI / 5;
          ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (p.kind === 'rocks') {
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.moveTo(sx, p.y + 8); ctx.lineTo(sx + p.width, p.y + 8); ctx.lineTo(sx + p.width - 4, p.y + p.height); ctx.lineTo(sx + 4, p.y + p.height);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath(); ctx.arc(cx - 5, p.y + 7, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx + 4, p.y + 5, 6, 0, Math.PI * 2); ctx.fill();
      }
      const label = { hardhat: 'HAT', turbo: 'TURBO', overtime: 'OT', rocks: 'ROCKS' }[p.kind];
      ctx.fillStyle = '#fde68a';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, cx, p.y - 3);
    };

    const drawRock = (r: Particle) => {
      const sx = r.x - cameraX;
      ctx.fillStyle = '#9ca3af';
      ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx + r.width / 2, r.y + r.height / 2, r.width / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };

    const drawLooseCoin = (c: Particle) => {
      if (c.life < 90 && Math.floor(c.life / 5) % 2 === 0) return;
      const sx = c.x - cameraX;
      if (sx + c.width < 0 || sx > CANVAS_W) return;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.ellipse(sx + c.width / 2, c.y + c.height / 2, c.width / 2, c.height / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 1.5; ctx.stroke();
    };

    const drawPlayerFx = () => {
      const sx = player.x - cameraX;
      if (overtime > 0 && (overtime > 90 || Math.floor(overtime / 5) % 2 === 0)) {
        ctx.fillStyle = `hsla(${(frame * 8) % 360},100%,60%,0.35)`;
        ctx.beginPath(); ctx.ellipse(sx + player.width / 2, player.y + player.height / 2, player.width, player.height * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      }
      if (turbo > 0) {
        const ex = player.facing === 1 ? sx + 3 : sx + player.width - 3;
        for (let i = 0; i < 3; i++) {
          const k = ((frame + i * 7) % 21) / 21;
          ctx.fillStyle = `rgba(75,85,99,${0.7 - k * 0.6})`;
          ctx.beginPath(); ctx.arc(ex - player.facing * k * 10, player.y + player.height * 0.05 - k * 14, 3 + k * 5, 0, Math.PI * 2); ctx.fill();
        }
      }
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
      if (hasRocks) {
        ctx.fillStyle = '#9ca3af';
        ctx.beginPath(); ctx.arc(stickEndX + f * 2, stickEndY - 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      if (hardhat) {
        const hy = player.y + player.height * 0.08;
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.ellipse(cabX + 8, hy, 7, 6, 0, Math.PI, 0); ctx.fill();
        ctx.fillRect(cabX + 0, hy - 1, 16, 2.5);
        ctx.fillStyle = '#ca8a04'; ctx.fillRect(cabX + 7, hy - 6, 2, 6);
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
      ctx.fillText(`FIELD TRAINING  ${String(scoreVal).padStart(6, '0')}`, 8, 20);
      ctx.textAlign = 'center';
      ctx.fillText(`RAISES: ${String(coinCount).padStart(2, '0')}`, CANVAS_W / 2, 20);
      ctx.textAlign = 'right';
      ctx.fillText(`LIVES: ${lives}`, CANVAS_W - 8, 20);
      const tags: [string, string][] = [];
      if (hardhat) tags.push(['HARD HAT', '#facc15']);
      if (hasRocks) tags.push(['ROCKS [F]', '#d1d5db']);
      if (turbo > 0) tags.push([`TURBO ${Math.ceil(turbo / 60)}s`, '#f87171']);
      if (overtime > 0) tags.push([`OVERTIME ${Math.ceil(overtime / 60)}s`, `hsl(${(frame * 8) % 360},100%,65%)`]);
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      let tx = 8;
      for (const [label, color] of tags) {
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(tx, 33, w, 13);
        ctx.fillStyle = color; ctx.fillText(label, tx + 4, 43);
        tx += w + 4;
      }
      if (toast.t > 0) {
        toast.t--;
        ctx.globalAlpha = Math.min(1, toast.t / 20);
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(CANVAS_W / 2 - ctx.measureText(toast.text).width / 2 - 8, 56, ctx.measureText(toast.text).width + 16, 22);
        ctx.fillStyle = '#fde68a';
        ctx.fillText(toast.text, CANVAS_W / 2, 72);
        ctx.globalAlpha = 1;
      }
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

    const drawBriefingScreen = () => {
      const pName = userNameRef.current;
      const di = dialogueIndexRef.current;
      const lf = dialogueLineFrameRef.current;
      const bf = briefingFrameRef.current;
      const DIALOGUE = stage === 2 ? [
        { speaker: 'f' as const, name: 'GEOFF',
          text: `Nice work, ${pName}. But the night shift crew just showed up — and they're faster.` },
        { speaker: 'o' as const, name: pName,
          text: `Bigger pits, quicker workers. I'll take the brick bridges across.` },
        { speaker: 'f' as const, name: 'GEOFF',
          text: `Reach the flag before sundown and the overtime's yours. Go!` },
      ] : [
        { speaker: 'f' as const, name: 'GEOFF',
          text: `Site's overrun with workers, ${pName}. Get that excavator moving.` },
        { speaker: 'o' as const, name: pName,
          text: `Copy that. I'll stomp through them and reach the flag.` },
        { speaker: 'f' as const, name: 'GEOFF',
          text: `Hit the ? boxes for gear, and stay off the steaming pipes. Don't scratch my machine.` },
      ];
      const cur = DIALOGUE[Math.min(di, DIALOGUE.length - 1)];
      const charsToShow = briefingTextDoneRef.current ? Infinity : lf * 2;
      if (!briefingTextDoneRef.current && lf * 2 >= cur.text.length) briefingTextDoneRef.current = true;
      const fActive = cur.speaker === 'f';
      const oActive = !fActive;
      const portY = 18, portH = 228, lpW = 238, rpX = 242;

      // Background
      ctx.fillStyle = '#060606';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // ── LEFT PORTRAIT – FOREMAN ──
      ctx.globalAlpha = fActive ? 1.0 : 0.3;
      ctx.fillStyle = fActive ? '#0f1629' : '#07090f';
      ctx.fillRect(0, portY, lpW, portH);
      const fcx = 119, fY = portY;
      // Hard hat (white)
      ctx.fillStyle = '#f1f5f9'; ctx.fillRect(fcx - 55, fY + 12, 110, 30);
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(fcx - 68, fY + 38, 136, 8);
      ctx.fillStyle = '#94a3b8'; ctx.fillRect(fcx - 60, fY + 40, 120, 4);
      // Face
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.ellipse(fcx, fY + 90, 48, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e5a050';
      ctx.fillRect(fcx - 48, fY + 90, 8, 44); ctx.fillRect(fcx + 40, fY + 90, 8, 44);
      // Ears
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(fcx - 56, fY + 78, 10, 20); ctx.fillRect(fcx + 46, fY + 78, 10, 20);
      // Heavy eyebrows (stern)
      ctx.fillStyle = '#713f12';
      ctx.fillRect(fcx - 34, fY + 66, 24, 5); ctx.fillRect(fcx + 10, fY + 66, 24, 5);
      ctx.fillRect(fcx - 34, fY + 62, 8, 5); ctx.fillRect(fcx + 26, fY + 62, 8, 5);
      // Eyes
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(fcx - 30, fY + 74, 16, 13); ctx.fillRect(fcx + 14, fY + 74, 16, 13);
      ctx.fillStyle = '#e0e7ff';
      ctx.fillRect(fcx - 27, fY + 76, 6, 6); ctx.fillRect(fcx + 21, fY + 76, 6, 6);
      // Nose
      ctx.fillStyle = '#d97706';
      ctx.fillRect(fcx - 7, fY + 92, 14, 9);
      ctx.fillRect(fcx - 14, fY + 98, 8, 5); ctx.fillRect(fcx + 6, fY + 98, 8, 5);
      // Thick mustache
      ctx.fillStyle = '#92400e'; ctx.fillRect(fcx - 24, fY + 105, 48, 7);
      // Stern mouth
      ctx.fillStyle = '#7c3600'; ctx.fillRect(fcx - 18, fY + 115, 36, 4);
      // Neck
      ctx.fillStyle = '#fde68a'; ctx.fillRect(fcx - 20, fY + 132, 40, 20);
      // Dark shirt base
      ctx.fillStyle = '#1f2937'; ctx.fillRect(0, fY + 148, lpW, portH - 150);
      // Hi-vis vest
      ctx.fillStyle = '#ea580c'; ctx.fillRect(fcx - 80, fY + 152, 160, portH - 154);
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(0, fY + 152, fcx - 80, portH - 154);
      ctx.fillRect(fcx + 80, fY + 152, lpW - (fcx + 80), portH - 154);
      // Hi-vis stripes
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(0, fY + 184, lpW, 10); ctx.fillRect(0, fY + 206, lpW, 10);
      // V-collar
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.moveTo(fcx - 14, fY + 150); ctx.lineTo(fcx, fY + 172); ctx.lineTo(fcx + 14, fY + 150); ctx.fill();
      // Portrait border
      ctx.strokeStyle = fActive ? '#3b82f6' : '#1e3a5f'; ctx.lineWidth = 2;
      ctx.strokeRect(1, portY + 1, lpW - 2, portH - 2);
      // Name plate
      ctx.fillStyle = fActive ? '#1d4ed8' : '#172554';
      ctx.fillRect(0, portY + portH - 22, lpW, 22);
      ctx.fillStyle = fActive ? '#bfdbfe' : '#3b82f6';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText('GEOFF', lpW / 2, portY + portH - 7);
      ctx.globalAlpha = 1.0;

      // ── DIVIDER ──
      ctx.fillStyle = '#000'; ctx.fillRect(lpW, portY, rpX - lpW, portH);

      // ── RIGHT PORTRAIT – OPERATOR ──
      ctx.globalAlpha = oActive ? 1.0 : 0.3;
      ctx.fillStyle = oActive ? '#1c1200' : '#0d0900';
      ctx.fillRect(rpX, portY, CANVAS_W - rpX, portH);
      const ocx = rpX + 119, oY = portY;
      // Yellow hard hat
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(ocx - 55, oY + 12, 110, 30);
      ctx.fillStyle = '#f59e0b'; ctx.fillRect(ocx - 68, oY + 38, 136, 8);
      ctx.fillStyle = '#d97706'; ctx.fillRect(ocx - 60, oY + 40, 120, 4);
      // Hat logo
      ctx.fillStyle = '#92400e'; ctx.fillRect(ocx - 14, oY + 17, 28, 16);
      ctx.fillStyle = '#fde68a'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center';
      ctx.fillText('IWC', ocx, oY + 28);
      // Face
      ctx.fillStyle = '#fde68a';
      ctx.beginPath(); ctx.ellipse(ocx, oY + 90, 48, 44, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e5a050';
      ctx.fillRect(ocx - 48, oY + 90, 8, 44); ctx.fillRect(ocx + 40, oY + 90, 8, 44);
      // Ears
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(ocx - 56, oY + 78, 10, 20); ctx.fillRect(ocx + 46, oY + 78, 10, 20);
      // Neutral brows
      ctx.fillStyle = '#78350f';
      ctx.fillRect(ocx - 30, oY + 68, 22, 4); ctx.fillRect(ocx + 8, oY + 68, 22, 4);
      // Eyes (confident)
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(ocx - 30, oY + 76, 16, 13); ctx.fillRect(ocx + 14, oY + 76, 16, 13);
      ctx.fillStyle = '#e0e7ff';
      ctx.fillRect(ocx - 27, oY + 78, 6, 6); ctx.fillRect(ocx + 21, oY + 78, 6, 6);
      // Nose
      ctx.fillStyle = '#d97706';
      ctx.fillRect(ocx - 7, oY + 94, 14, 9);
      ctx.fillRect(ocx - 14, oY + 100, 8, 5); ctx.fillRect(ocx + 6, oY + 100, 8, 5);
      // Slight smile
      ctx.fillStyle = '#92400e';
      ctx.fillRect(ocx - 16, oY + 112, 32, 4);
      ctx.fillRect(ocx - 20, oY + 110, 6, 5); ctx.fillRect(ocx + 14, oY + 110, 6, 5);
      // Neck
      ctx.fillStyle = '#fde68a'; ctx.fillRect(ocx - 20, oY + 132, 40, 20);
      // Work shirt (dark teal)
      ctx.fillStyle = '#134e4a'; ctx.fillRect(rpX, oY + 148, CANVAS_W - rpX, portH - 150);
      ctx.fillStyle = '#0f766e'; ctx.fillRect(ocx - 70, oY + 152, 140, portH - 154);
      ctx.fillStyle = '#134e4a';
      ctx.fillRect(rpX, oY + 152, ocx - 70 - rpX, portH - 154);
      ctx.fillRect(ocx + 70, oY + 152, CANVAS_W - (ocx + 70), portH - 154);
      // Chest pocket
      ctx.fillStyle = '#0d5752'; ctx.fillRect(ocx - 42, oY + 172, 34, 22);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(ocx - 40, oY + 174, 16, 3);
      // V-collar
      ctx.fillStyle = '#134e4a';
      ctx.beginPath();
      ctx.moveTo(ocx - 14, oY + 150); ctx.lineTo(ocx, oY + 170); ctx.lineTo(ocx + 14, oY + 150); ctx.fill();
      // Portrait border
      ctx.strokeStyle = oActive ? '#f59e0b' : '#78350f'; ctx.lineWidth = 2;
      ctx.strokeRect(rpX + 1, portY + 1, CANVAS_W - rpX - 2, portH - 2);
      // Name plate
      ctx.fillStyle = oActive ? '#92400e' : '#451a03';
      ctx.fillRect(rpX, portY + portH - 22, CANVAS_W - rpX, 22);
      ctx.fillStyle = oActive ? '#fde68a' : '#d97706';
      ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
      ctx.fillText(pName.substring(0, 12), rpX + (CANVAS_W - rpX) / 2, portY + portH - 7);
      ctx.globalAlpha = 1.0;

      // ── HEADER ──
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, CANVAS_W, portY);
      ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText('FIELD TRAINING', 6, 13);
      ctx.fillStyle = '#6b7280'; ctx.textAlign = 'center';
      ctx.fillText('PRE-MISSION', CANVAS_W / 2, 13);
      ctx.fillStyle = '#4ade80'; ctx.textAlign = 'right';
      ctx.fillText(`STAGE ${stage}`, CANVAS_W - 6, 13);

      // ── TEXT BOX ──
      const tbY = portY + portH, tbH = CANVAS_H - tbY;
      ctx.fillStyle = '#080808'; ctx.fillRect(0, tbY, CANVAS_W, tbH);
      ctx.fillStyle = fActive ? '#3b82f6' : '#f59e0b';
      ctx.fillRect(0, tbY, CANVAS_W, 3);
      // Name tag
      ctx.fillStyle = fActive ? '#1d4ed8' : '#b45309';
      ctx.fillRect(5, tbY + 6, 90, 20);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
      ctx.fillText(cur.name.substring(0, 10), 50, tbY + 19);
      // Dialogue text with word wrap
      const displayText = cur.text.substring(0, Math.min(charsToShow, cur.text.length));
      ctx.font = '11px monospace'; ctx.fillStyle = '#f3f4f6'; ctx.textAlign = 'left';
      const txStart = 8, txWidth = CANVAS_W - 16;
      const words = displayText.split(' ');
      let lineStr = '', lineY2 = tbY + 35, lastLine = '';
      for (const word of words) {
        const test = lineStr ? lineStr + ' ' + word : word;
        if (ctx.measureText(test).width > txWidth && lineStr) {
          ctx.fillText(lineStr, txStart, lineY2);
          lineStr = word; lineY2 += 16;
        } else { lineStr = test; }
      }
      lastLine = lineStr;
      if (lineStr) ctx.fillText(lineStr, txStart, lineY2);
      // Cursor
      if (!briefingTextDoneRef.current && Math.floor(bf / 8) % 2 === 0) {
        const cw = ctx.measureText(lastLine).width;
        ctx.fillStyle = fActive ? '#93c5fd' : '#fcd34d';
        ctx.fillRect(txStart + cw + 2, lineY2 - 9, 5, 10);
      }
      // Progress dots
      for (let d = 0; d < 3; d++) {
        ctx.fillStyle = d <= di ? (fActive ? '#3b82f6' : '#f59e0b') : '#374151';
        ctx.fillRect(CANVAS_W / 2 - 11 + d * 10, CANVAS_H - 9, 7, 7);
      }
      // Prompt
      if (briefingTextDoneRef.current) {
        const blink = Math.floor(bf / 20) % 2 === 0;
        ctx.fillStyle = blink ? '#fbbf24' : '#78350f';
        ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
        ctx.fillText(di >= 2 ? '\u25ba START MISSION' : '\u25ba NEXT', CANVAS_W - 6, CANVAS_H - 4);
      }
    };

    // ---- Keyboard ----
    const onKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
      if ([' ','Enter'].includes(e.key)) {
        if (gsRef.current === 'start') { gsRef.current = 'briefing'; briefingFrameRef.current = 0; briefingTextDoneRef.current = false; dialogueIndexRef.current = 0; dialogueLineFrameRef.current = 0; setDisplayState('briefing'); }
        else if (gsRef.current === 'briefing') {
          if (!briefingTextDoneRef.current) { briefingTextDoneRef.current = true; }
          else if (dialogueIndexRef.current < 2) { dialogueIndexRef.current++; briefingTextDoneRef.current = false; dialogueLineFrameRef.current = 0; }
          else { gsRef.current = 'playing'; setDisplayState('playing'); }
        }
        else if (gsRef.current === 'gameover' || gsRef.current === 'win') restart();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const restart = () => {
      scoreVal = 0; lives = 3; coinCount = 0;
      setScore(0);
      stage = 1;
      stageBanner = 0;
      hardhat = false; hasRocks = false; toast = { text: '', t: 0 };
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

      if (gs === 'start')    { drawSplashScreen('FIELD TRAINING', 'Arrow/WASD to move, Space to jump', '#fbbf24'); return; }
      if (gs === 'briefing') { briefingFrameRef.current++; dialogueLineFrameRef.current++; drawBriefingScreen(); return; }
      if (gs === 'gameover') { drawSplashScreen('GAME OVER', 'You ran out of lives!', '#dc2626'); return; }
      if (gs === 'win')      { drawSplashScreen('Congratulations!', 'Now get back to work!', '#4ade80'); return; }

      // Input
      const k = keysRef.current;
      const t = touchRef.current;
      const maxV = turbo > 0 ? 7 : 5, accel = turbo > 0 ? 1.2 : 0.9;
      if (k['ArrowLeft']  || k['a'] || k['A'] || t.left)  { player.vx = Math.max(player.vx - accel, -maxV); player.facing = -1; }
      else if (k['ArrowRight'] || k['d'] || k['D'] || t.right) { player.vx = Math.min(player.vx + accel, maxV);  player.facing = 1;  }
      else { player.vx *= 0.82; }

      if (rockCooldown > 0) rockCooldown--;
      if (hasRocks && rockCooldown <= 0 && rocks.length < 3 && (k['f'] || k['F'] || k['x'] || k['X'] || t.throw)) {
        rocks.push({ x: player.facing === 1 ? player.x + player.width : player.x - 12, y: player.y + 8, width: 12, height: 12, vx: player.facing * 6 + player.vx * 0.3, vy: -3, life: 150 });
        rockCooldown = 18;
      }

      if ((k['ArrowUp'] || k['w'] || k['W'] || k[' '] || t.jump) && player.grounded) {
        player.vy = turbo > 0 ? -13.5 : -12;
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
              if (b.powerup) {
                level.powerupItems.push({ x: b.x + 4, y: b.y - TILE, width: 24, height: 24, vx: 1.5, vy: -3, alive: true, kind: b.powerup });
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

      // Powerup items
      for (const p of level.powerupItems) {
        if (!p.alive) continue;
        p.x += p.vx;
        p.vy += GRAVITY;
        p.y += p.vy;
        for (const b of level.grounds) {
          if (overlap(p, b) && p.vy >= 0) { p.y = b.y - p.height; p.vy = p.kind === 'overtime' ? -7 : 0; }
        }
        for (const b of level.pipes) {
          if (overlap(p, b)) {
            p.vx *= -1;
            p.x += p.vx > 0 ? b.x + b.width - p.x : b.x - p.x - p.width;
          }
        }
        if (p.y > CANVAS_H + 80) p.alive = false;
        if (p.alive && overlap(player, p)) {
          p.alive = false;
          if (p.kind === 'life') lives = Math.min(lives + 1, 9);
          else if (p.kind === 'hardhat') hardhat = true;
          else if (p.kind === 'turbo') turbo = TURBO_FRAMES;
          else if (p.kind === 'overtime') overtime = OVERTIME_FRAMES;
          else if (p.kind === 'rocks') hasRocks = true;
          showToast(POWER_LABEL[p.kind]);
          addScore(500);
          coinPops.push({ x: p.x + p.width / 2, y: p.y, vy: -5, vx: 0, life: 50, max: 50 });
        }
      }
      if (turbo > 0) turbo--;
      if (overtime > 0) overtime--;

      // Thrown rocks
      for (const r of rocks) {
        const prevBottom = r.y + r.height;
        r.vy += GRAVITY; r.x += r.vx; r.y += r.vy; r.life--;
        for (const b of allSolids()) {
          if (!overlap(r, b)) continue;
          if (r.vy > 0 && prevBottom <= b.y + 6) { r.y = b.y - r.height; r.vy = -5; }
          else { r.life = 0; break; }
        }
        for (const e of level.enemies) {
          if (r.life > 0 && e.alive && !e.squished && overlap(r, e)) { knockOut(e); r.life = 0; }
        }
        if (r.y > CANVAS_H + 40 || Math.abs(r.x - player.x) > CANVAS_W) r.life = 0;
      }
      rocks = rocks.filter(r => r.life > 0);

      // Pipes: steam vents, coin geysers, worker spawns
      for (const b of level.pipes) {
        if (!b.pipe) continue;
        b.timer = (b.timer ?? 0) + 1;
        const near = Math.abs(b.x - player.x) < CANVAS_W;
        if (b.pipe === 'steam') {
          if (b.timer % STEAM_CYCLE >= STEAM_ON && overlap(player, steamColumn(b))) hurtPlayer();
        } else if (b.pipe === 'coins') {
          if (near && b.timer % 200 === 0) {
            for (let i = 0; i < 3; i++) {
              looseCoins.push({ x: b.x + b.width / 2 - 7, y: b.y - 14, width: 14, height: 14, vx: (i - 1) * 1.8, vy: -8 - (i % 2) * 1.5, life: 360 });
            }
          }
        } else if (b.pipe === 'workers') {
          const cx = b.x + b.width / 2;
          if (near && b.timer % 300 === 0 && Math.abs(player.x + player.width / 2 - cx) > TILE * 2 &&
              level.enemies.filter(e => e.alive && e.from === b).length < 2) {
            const dir = player.x < b.x ? -1 : 1;
            level.enemies.push({
              x: cx - 14, y: b.y, width: 28, height: 28, vx: dir * 3, vy: 0, alive: true, squished: false, timer: 0,
              from: b, emerging: 28, walk: stage === 2 ? 2 : 1.4,
            });
          }
        }
      }

      // Coins shot out of pipes
      for (const c of looseCoins) {
        const prevBottom = c.y + c.height;
        c.vy = Math.min(c.vy + 0.35, 10); c.x += c.vx; c.y += c.vy; c.life--;
        for (const b of allSolids()) {
          if (overlap(c, b) && c.vy > 0 && prevBottom <= b.y + 6) { c.y = b.y - c.height; c.vy = 0; c.vx *= 0.6; }
        }
        if (overlap(player, c)) { c.life = 0; coinCount++; addScore(100); }
        if (c.y > CANVAS_H + 40) c.life = 0;
      }
      looseCoins = looseCoins.filter(c => c.life > 0);

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
        if (e.emerging) {
          e.y -= 1;
          if (--e.emerging <= 0) e.vy = -6;
        } else {
        e.x += e.vx;
        e.vy += GRAVITY;
        e.y += e.vy;

        // Vertical collision - ground only
        let grounded = false;
        for (const b of level.grounds) {
          if (overlap(e, b) && e.vy >= 0) { e.y = b.y - e.height; e.vy = 0; grounded = true; }
        }
        if (grounded && e.walk) { e.vx = Math.sign(e.vx) * e.walk; e.walk = undefined; }
        if (e.y > CANVAS_H + 100) { e.alive = false; continue; }

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
        if (!hitPipe && grounded) {
          const lookX = e.vx > 0 ? e.x + e.width + 2 : e.x - 2;
          const groundAhead = level.grounds.some(b =>
            lookX >= b.x && lookX < b.x + b.width && Math.abs(e.y + e.height - b.y) < 6
          );
          if (!groundAhead) e.vx *= -1;
        }

        if (e.x < 0) { e.x = 0; e.vx = Math.abs(e.vx); }
        }

        if (overlap(player, e)) {
          const prevBottom = player.y + player.height - player.vy;
          if (overtime > 0) {
            knockOut(e);
          } else if (player.vy > 0 && prevBottom <= e.y + 6) {
            knockOut(e);
            player.vy = -8;
          } else {
            hurtPlayer();
          }
          if (gsRef.current !== 'playing') return;
        }
      }

      // Camera
      cameraX = Math.max(0, Math.min(player.x - CANVAS_W / 3, WORLD_W - CANVAS_W));

      // Fall
      if (player.y > CANVAS_H + 80 && invincible <= 0) loseLife();
      if (gsRef.current !== 'playing') return;

      if (invincible > 0) invincible--;

      // Flag / win
      if (player.x + player.width >= flagX && player.x <= flagX + 10) {
        scoreVal += 1000; setScore(s => s + 1000);
        if (stage === 1) {
          stage = 2;
          level = buildLevel2();
          coinPops = [];
          toast = { text: '', t: 0 };
          resetPlayer();
          stageBanner = 150;
          gsRef.current = 'briefing'; briefingFrameRef.current = 0; briefingTextDoneRef.current = false; dialogueIndexRef.current = 0; dialogueLineFrameRef.current = 0; setDisplayState('briefing');
          return;
        }
        gsRef.current = 'win'; setDisplayState('win');
      }

      // Draw
      const th = theme();
      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, th.skyTop);
      sky.addColorStop(1, th.skyBottom);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (const h of hills) {
        const hsx = h.x - cameraX;
        if (hsx + h.r * 2 < 0 || hsx - h.r > CANVAS_W) continue;
        ctx.fillStyle = th.hill;
        ctx.beginPath(); ctx.arc(hsx, GROUND_Y, h.r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = th.hillHi;
        ctx.beginPath(); ctx.arc(hsx - 18, GROUND_Y - h.r * 0.5, h.r * 0.28, Math.PI, 0); ctx.fill();
      }
      for (const cl of clouds) drawCloud(cl.x, cl.y, cl.w, cl.h);
      for (const b of level.grounds)   drawGroundBlock(b);
      for (const b of level.bricks)    drawBrickBlock(b);
      for (const b of level.questions) drawQuestionBlock(b);
      for (const e of level.enemies) if (e.alive && e.emerging) drawLaborer(e);
      for (const b of level.pipes)     drawPipe(b);
      for (const b of level.pipes)     if (b.pipe === 'steam') drawSteam(b);
      for (const c of level.floatCoins) drawCoin(c);
      for (const c of looseCoins) drawLooseCoin(c);
      drawFlag();
      for (const e of level.enemies) if (e.alive && !e.emerging) drawLaborer(e);
      for (const p of level.powerupItems) if (p.alive) drawPowerupItem(p);
      drawPlayerFx();
      // Flash player when invincible
      if (invincible <= 0 || Math.floor(invincible / 6) % 2 === 0) drawPlayer();
      for (const r of rocks) drawRock(r);

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

      if (stageBanner > 0) {
        stageBanner--;
        ctx.globalAlpha = Math.min(1, stageBanner / 30);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, CANVAS_H / 2 - 30, CANVAS_W, 50);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STAGE 2: NIGHT SHIFT', CANVAS_W / 2, CANVAS_H / 2 + 2);
        ctx.globalAlpha = 1;
      }
    };

    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  return (
    <div className="min-h-screen bg-blue-900 dark:bg-black text-white px-2 sm:px-4 py-2 -mx-2 sm:-mx-4 lg:mx-0 lg:p-2">
      <div className="max-w-2xl mx-auto">
        <div className="bg-blue-800 dark:bg-black border-2 border-yellow-400 rounded-lg shadow-2xl p-3">
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
              <div className="flex gap-3 items-end">
              <button
                onTouchStart={(e) => { e.preventDefault(); touchRef.current.throw = true; }}
                onTouchEnd={(e)   => { e.preventDefault(); touchRef.current.throw = false; }}
                onMouseDown={() => { touchRef.current.throw = true; }}
                onMouseUp={()    => { touchRef.current.throw = false; }}
                onMouseLeave={()  => { touchRef.current.throw = false; }}
                className="w-14 h-14 bg-gray-600 border-2 border-gray-300 rounded-full flex items-center justify-center text-white font-bold text-xs active:bg-gray-400 touch-none shadow-lg"
              >ROCK</button>
              <button
                onTouchStart={(e) => {
                  e.preventDefault();
                  touchRef.current.jump = true;
                  if (gsRef.current !== 'playing') {
                    if (gsRef.current === 'start') { gsRef.current = 'briefing'; briefingFrameRef.current = 0; briefingTextDoneRef.current = false; dialogueIndexRef.current = 0; dialogueLineFrameRef.current = 0; setDisplayState('briefing'); }
                    else if (gsRef.current === 'briefing') {
                      if (!briefingTextDoneRef.current) { briefingTextDoneRef.current = true; }
                      else if (dialogueIndexRef.current < 2) { dialogueIndexRef.current++; briefingTextDoneRef.current = false; dialogueLineFrameRef.current = 0; }
                      else { gsRef.current = 'playing'; setDisplayState('playing'); }
                    }
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
          </div>

          <p className="text-center text-blue-300 text-xs mt-2 hidden lg:block">
            Arrow keys / WASD = move &nbsp;|&nbsp; Space = jump &nbsp;|&nbsp; F / X = throw rocks &nbsp;|&nbsp; Stomp enemies &nbsp;|&nbsp; Hit ? blocks &nbsp;|&nbsp; Reach the flag!
          </p>
        </div>

        {/* High Scores Leaderboard */}
        <div className="mt-3 bg-blue-800 dark:bg-gray-900 border-2 border-yellow-400 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-yellow-400 font-mono font-bold text-sm flex items-center gap-2">
              <Trophy size={16} /> HIGH SCORES
            </h2>
            {user?.role === 'admin' && highScores.length > 0 && (
              <button onClick={clearScores} className="text-gray-400 hover:text-red-400 text-xs font-mono">CLEAR</button>
            )}
          </div>
          {scoresLoading ? (
            <p className="text-gray-400 font-mono text-xs text-center py-2">Loading scores…</p>
          ) : highScores.length === 0 ? (
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
