import { useMemo, useState } from 'react';

const ROWS = 4;
const COLS = 6;
const BET_STEPS = [0.5, 1, 2, 5, 10, 20];
const SYMBOLS = [
  // Row 1
  { id: 'triple7', label: 'Jackpot', color: '#a855f7', pay: 50.0, img: '/Image1.png', weight: 2 },
  { id: 'watermelon', label: 'Melon', color: '#ef4444', pay: 2.0, img: '/Image2.png', weight: 4 },
  // Row 2
  { id: 'apple', label: 'Apple', color: '#ef4444', pay: 1.2, img: '/Image4.png', weight: 6 },
  { id: 'suits', label: 'Suits', color: '#9ca3af', pay: 1.0, img: '/Image5.png', weight: 7 },
  { id: 'crown', label: 'Crown', color: '#eab308', pay: 40.0, img: '/Image6.png', weight: 2 },
  // Row 3
  { id: 'bonus', label: 'Bonus', color: '#3b82f6', pay: 8.0, img: '/Image7.png', weight: 2 },
  { id: 'cherry', label: 'Cherry', color: '#ef4444', pay: 1.5, img: '/Image8.png', weight: 5 },
  { id: 'coin', label: 'Coin', color: '#f59e0b', pay: 2.5, img: '/Image9.png', weight: 4 },
  // Row 4
  { id: 'wild', label: 'Wild', color: '#22c55e', pay: 10.0, img: '/Image10.png', weight: 5 }, // Increased weight for Wilds
  { id: 'lemon', label: 'Lemon', color: '#eab308', pay: 1.4, img: '/Image11.png', weight: 5 },
  { id: 'red7', label: 'Seven', color: '#ef4444', pay: 3.0, img: '/Image12.png', weight: 3 },
];

// Create a weighted pool to increase the frequency of low-paying symbols
const WEIGHTED_POOL = [];
SYMBOLS.forEach((s) => {
  for (let i = 0; i < s.weight; i++) WEIGHTED_POOL.push(s);
});

const getSymbol = (isNew = true) => {
  const template = WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
  return { ...template, uid: Math.random().toString(36).substr(2, 9), isNew };
};

const buildGrid = () =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => getSymbol())
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scanWins = (grid) => {
  const visited = new Set();
  const clusters = [];
  const getKey = (r, c) => `${r}-${c}`;
  const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

  // 1. Identify all unique symbol types present (excluding Wilds/Bonus)
  // We will run a search for each "target" type.
  const presentTypes = new Set();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = grid[r][c].id;
      if (id !== 'wild' && id !== 'bonus') presentTypes.add(id);
    }
  }

  // Global set of matched cells to avoid double-counting standard wins across passes
  const matchedCells = new Set();

  presentTypes.forEach((targetId) => {
    const typeVisited = new Set();
    
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = getKey(r, c);
        if (typeVisited.has(key)) continue;

        const cellId = grid[r][c].id;
        // Start search if it's the target or a Wild
        if (cellId === targetId || cellId === 'wild') {
          const group = [];
          const queue = [[r, c]];
          typeVisited.add(key);
          group.push([r, c]);

          let head = 0;
          while (head < queue.length) {
            const [currR, currC] = queue[head++];

            for (const [dr, dc] of directions) {
              const nr = currR + dr;
              const nc = currC + dc;
              const nKey = getKey(nr, nc);

              if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !typeVisited.has(nKey)) {
                const nId = grid[nr][nc].id;
                // Match if neighbor is Target OR Wild
                if (nId === targetId || nId === 'wild') {
                  typeVisited.add(nKey);
                  group.push([nr, nc]);
                  queue.push([nr, nc]);
                }
              }
            }
          }

          if (group.length >= 3) {
             clusters.push({
               id: targetId, // The "Identity" of this cluster
               color: SYMBOLS.find(s => s.id === targetId).color,
               coords: group
             });
             group.forEach(([gr, gc]) => matchedCells.add(getKey(gr, gc)));
          }
        }
      }
    }
  });

  // 2. Handle "Only Wilds" clusters? 
  // If a cluster is pure wilds, the above loop won't catch it unless we iterate 'wild' as a target type.
  // Let's do a pass for pure Wilds if they haven't been matched yet.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const key = getKey(r, c);
      if (grid[r][c].id === 'wild' && !matchedCells.has(key)) {
      }
    }
  }

  // 3. Bonus Scatter Logic
  const bonusCells = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c].id === 'bonus') {
        bonusCells.push([r, c]);
      }
    }
  }

  if (bonusCells.length >= 3) {
    clusters.push({
      id: 'bonus',
      color: '#3b82f6',
      coords: bonusCells, // All scatter cells
      isScatter: true
    });
    bonusCells.forEach(([r, c]) => matchedCells.add(getKey(r, c)));
  }

  const matches = [];
  let totalWin = 0;

  clusters.forEach((cluster) => {
    cluster.coords.forEach(([r, c]) => matches.push([r, c]));
    const symbolDef = SYMBOLS.find(s => s.id === cluster.id);
    let basePay = symbolDef ? symbolDef.pay : 0;
    
    // Bonus Scatter Pay: High fixed amount?
    if (cluster.isScatter) {
      basePay = 25.0; // Big win for bonus
    }

    // Payout multiplier
    totalWin += basePay * cluster.coords.length * (1 + (cluster.coords.length - 3) * 0.5);
  });
  
  // Deduplicate matches for the collapse phase
  const uniqueMatches = Array.from(new Set(matches.map(m => m.join('-')))).map(s => s.split('-').map(Number));

  return {
    matches: uniqueMatches,
    clusters,
    win: Number(totalWin.toFixed(2)),
  };
};

const collapseGrid = (grid, matches) => {
  const nextGrid = Array.from({ length: ROWS }, () => new Array(COLS));
  const kill = new Set(matches.map(([r, c]) => `${r}-${c}`));

  for (let c = 0; c < COLS; c += 1) {
    const kept = [];
    // Collect survivors from bottom up
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (!kill.has(`${r}-${c}`)) {
        kept.push(grid[r][c]); // Preserve the exact object instance
      }
    }

    // Fill column from bottom up
    let rowPtr = ROWS - 1;
    // 1. Place kept symbols
    for (const symbol of kept) {
      nextGrid[rowPtr][c] = { ...symbol, isNew: false };
      rowPtr -= 1;
    }

    // 2. Fill remaining top spots with new symbols
    while (rowPtr >= 0) {
      nextGrid[rowPtr][c] = getSymbol();
      rowPtr -= 1;
    }
  }

  return nextGrid;
};

function App() {
  const [grid, setGrid] = useState(() => buildGrid());
  const [balance, setBalance] = useState(200);
  const [bet, setBet] = useState(2);
  const [spinning, setSpinning] = useState(false);
  
  // 'highlighted' creates a Set of "r-c" strings for winning cells
  const [highlighted, setHighlighted] = useState(new Set());
  
  // 'winningClusters' stores the actual cluster data for drawing lines
  const [winningClusters, setWinningClusters] = useState([]);
  
  // 'popping' state to trigger the disappearance animation
  const [popping, setPopping] = useState(false);

  const [totalWin, setTotalWin] = useState(0);
  const [roundWin, setRoundWin] = useState(0);
  const [showWinBanner, setShowWinBanner] = useState(false);
  const [dropTick, setDropTick] = useState(0);
  const [spinMessage, setSpinMessage] = useState('Press Spin to begin');
  const [history, setHistory] = useState([]);

  const canSpin = balance >= bet && !spinning;

  const gridRows = useMemo(
    () => grid.map((row) => row.map((cell) => ({ ...cell }))),
    [grid]
  );
  
  const getCenter = (r, c) => ({
    x: (c * 100) / COLS + (100 / COLS / 2),
    y: (r * 100) / ROWS + (100 / ROWS / 2),
  });

  const spin = async () => {
    if (!canSpin) return;

    setSpinning(true);
    setTotalWin(0);
    setRoundWin(0);
    setShowWinBanner(false);
    setBalance((prev) => Number((prev - bet).toFixed(2)));
    setSpinMessage('Spinning...');

    let current = buildGrid();
    setGrid(current);
    setDropTick((prev) => prev + 1);

    let cascades = 0;
    let payout = 0;

    await sleep(650);

    while (true) {
      const result = scanWins(current);

      if (!result.matches.length) {
        setHighlighted(new Set());
        setWinningClusters([]);
        break;
      }

      cascades += 1;
      const scaledWin = Number((result.win * bet * 0.07).toFixed(2));
      payout = Number((payout + scaledWin).toFixed(2));
      setTotalWin(payout);
      setSpinMessage(`Cascade ${cascades}: +$${scaledWin.toFixed(2)}`);

      const nextHighlight = new Set(result.matches.map(([r, c]) => `${r}-${c}`));
      setHighlighted(nextHighlight);
      setWinningClusters(result.clusters);

      // 1. Show Lines + Win Pulse
      await sleep(600);
      
      // 2. Trigger Pop (scale down)
      setPopping(true); 
      await sleep(350); 

      // 3. Collapse
      current = collapseGrid(current, result.matches);
      setGrid(current);
      setDropTick((prev) => prev + 1);
      
      // Reset states for next iteration
      setPopping(false);
      setHighlighted(new Set());
      setWinningClusters([]);
      
      await sleep(900);
    }

    if (payout > 0) {
      setBalance((prev) => Number((prev + payout).toFixed(2)));
      setRoundWin(payout);
      setShowWinBanner(true);
      setTimeout(() => setShowWinBanner(false), 1700);
      setSpinMessage(`Won $${payout.toFixed(2)} in ${cascades} cascade${cascades > 1 ? 's' : ''}`);
    } else {
      setSpinMessage('No win this spin');
    }

    setHistory((prev) => [
      {
        id: crypto.randomUUID(),
        at: new Date().toLocaleTimeString(),
        bet,
        payout,
        cascades,
      },
      ...prev,
    ].slice(0, 10));

    setSpinning(false);
  };

  return (
    <div className="app-shell">
      <div className="ambient" />
      <main className="game-layout">
        <section className="slot-panel">
          <header className="panel-head">
            <div>
              <h1>Crystal Vault</h1>
            </div>
            <div className="chip">{spinning ? 'IN PLAY' : 'READY'}</div>
          </header>

          <div className="meta-row">
            <div className="metric"><span>Balance</span><strong>${balance.toFixed(2)}</strong></div>
            <div className="metric"><span>Bet</span><strong>${bet.toFixed(2)}</strong></div>
            <div className="metric win"><span>Current Win</span><strong>${totalWin.toFixed(2)}</strong></div>
          </div>

          <div className="grid-wrap">
            <svg className="win-lines">
              {winningClusters.map((cluster, i) =>
                cluster.coords.slice(0, -1).map(([r1, c1], j) => {
                  const [r2, c2] = cluster.coords[j + 1];
                  return null; 
                })
              )}
              {winningClusters.map((cluster, i) => {
                 // Draw lines between adjacent cells in the cluster
                 const lines = [];
                 const coordsSet = new Set(cluster.coords.map(([r, c]) => `${r}-${c}`));
                 
                 cluster.coords.forEach(([r, c]) => {
                   // Check right and down to avoid double drawing
                   [[0,1], [1,0]].forEach(([dr, dc]) => {
                     const nr = r + dr;
                     const nc = c + dc;
                     if (coordsSet.has(`${nr}-${nc}`)) {
                       const start = getCenter(r, c);
                       const end = getCenter(nr, nc);
                       lines.push(
                         <line
                           key={`${i}-${r}-${c}-${nr}-${nc}`}
                           x1={`${start.x}%`}
                           y1={`${start.y}%`}
                           x2={`${end.x}%`}
                           y2={`${end.y}%`}
                           stroke={cluster.color}
                           strokeWidth="6"
                           strokeLinecap="round"
                           className="win-line-path"
                         />
                       );
                     }
                   });
                 });
                 return lines;
              })}
            </svg>

            {showWinBanner && (
              <div className="win-banner">
                <p>BIG WIN</p>
                <strong>+${roundWin.toFixed(2)}</strong>
              </div>
            )}
            <div className={`grid ${spinning ? 'spinning' : ''}`}>
              {Array.from({ length: COLS }).map((_, c) => (
                <div key={`col-${c}`} className="column-track">
                  {gridRows.map((row, r) => {
                    const cell = row[c];
                    const key = cell.uid; // Use UID for stable identity
                    const isWin = highlighted.has(`${r}-${c}`);
                    
                    return (
                      <div
                        key={key}
                        className={`cell ${isWin ? 'win' : ''} ${isWin && popping ? 'pop' : ''}`}
                        style={{
                          '--accent': cell.color,
                          top: `${r * 25.4}%`, // 4 rows -> ~25% each with gap accounted approx
                          height: '24%', // Leave some gap
                          position: 'absolute',
                          width: '100%',
                          transition: 'top 0.6s cubic-bezier(0.25, 1, 0.5, 1)',
                          animation: cell.isNew ? 'symbolDrop 0.6s cubic-bezier(0.25, 1, 0.5, 1) both' : 'none'
                        }}
                      >
                        <div className="symbol-icon" style={{ backgroundImage: `url(${cell.img})` }}></div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <footer className="controls">
            <div className="bets">
              {BET_STEPS.map((value) => (
                <button
                  key={value}
                  className={value === bet ? 'active' : ''}
                  onClick={() => setBet(value)}
                  disabled={spinning}
                >
                  ${value}
                </button>
              ))}
            </div>
            <button className="spin-btn" onClick={spin} disabled={!canSpin}>
              {spinning ? 'Resolving...' : 'Spin'}
            </button>
          </footer>

          <p className="status">{spinMessage}</p>
        </section>

        <aside className="history-panel">
          <h2>Game History</h2>
          <div className="history-list">
            {history.length === 0 && <p className="empty">No rounds yet.</p>}
            {history.map((entry) => (
              <article key={entry.id} className="history-card">
                <header>
                  <span>{entry.at}</span>
                  <strong className={entry.payout > 0 ? 'plus' : ''}>
                    {entry.payout > 0 ? `+$${entry.payout.toFixed(2)}` : '$0.00'}
                  </strong>
                </header>
                <p>Bet: ${entry.bet.toFixed(2)}</p>
                <p>Cascades: {entry.cascades}</p>
              </article>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
