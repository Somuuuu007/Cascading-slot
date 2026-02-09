import { useMemo, useState } from 'react';

const ROWS = 5;
const COLS = 6;
const BET_STEPS = [0.5, 1, 2, 5, 10, 20];
const SYMBOLS = [
  { id: 'ruby', icon: '7', label: 'Ruby', color: '#fb7185', pay: 1.8 },
  { id: 'emerald', icon: '$', label: 'Cash', color: '#34d399', pay: 1.6 },
  { id: 'sapphire', icon: '★', label: 'Star', color: '#60a5fa', pay: 1.5 },
  { id: 'amber', icon: '♛', label: 'Crown', color: '#fbbf24', pay: 1.4 },
  { id: 'violet', icon: '💎', label: 'Gem', color: '#a78bfa', pay: 1.3 },
  { id: 'pearl', icon: '🍀', label: 'Luck', color: '#d1d5db', pay: 1.2 },
];

const randomSymbol = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];

const buildGrid = () =>
  Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => randomSymbol())
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const scanWins = (grid) => {
  const counts = {};

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = grid[r][c];
      counts[cell.id] = (counts[cell.id] || 0) + 1;
    }
  }

  const winners = new Set(
    Object.entries(counts)
      .filter(([, count]) => count >= 8)
      .map(([id]) => id)
  );

  const matches = [];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (winners.has(grid[r][c].id)) matches.push([r, c]);
    }
  }

  const win = matches.reduce((sum, [r, c]) => {
    const symbol = grid[r][c];
    return sum + symbol.pay;
  }, 0);

  return {
    matches,
    win: Number(win.toFixed(2)),
  };
};

const collapseGrid = (grid, matches) => {
  const next = grid.map((row) => row.slice());
  const kill = new Set(matches.map(([r, c]) => `${r}-${c}`));

  for (let c = 0; c < COLS; c += 1) {
    const kept = [];
    for (let r = ROWS - 1; r >= 0; r -= 1) {
      if (!kill.has(`${r}-${c}`)) kept.push(next[r][c]);
    }

    let rowPtr = ROWS - 1;
    for (const symbol of kept) {
      next[rowPtr][c] = symbol;
      rowPtr -= 1;
    }

    while (rowPtr >= 0) {
      next[rowPtr][c] = randomSymbol();
      rowPtr -= 1;
    }
  }

  return next;
};

function App() {
  const [grid, setGrid] = useState(() => buildGrid());
  const [balance, setBalance] = useState(200);
  const [bet, setBet] = useState(2);
  const [spinning, setSpinning] = useState(false);
  const [highlighted, setHighlighted] = useState(new Set());
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
        break;
      }

      cascades += 1;
      const scaledWin = Number((result.win * bet * 0.07).toFixed(2));
      payout = Number((payout + scaledWin).toFixed(2));
      setTotalWin(payout);
      setSpinMessage(`Cascade ${cascades}: +$${scaledWin.toFixed(2)}`);

      const nextHighlight = new Set(result.matches.map(([r, c]) => `${r}-${c}`));
      setHighlighted(nextHighlight);

      await sleep(450);
      current = collapseGrid(current, result.matches);
      setGrid(current);
      setDropTick((prev) => prev + 1);
      await sleep(650);
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
              <p className="eyebrow">Cascading Slots</p>
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
            {showWinBanner && (
              <div className="win-banner">
                <p>BIG WIN</p>
                <strong>+${roundWin.toFixed(2)}</strong>
              </div>
            )}
            <div className={`grid ${spinning ? 'spinning' : ''}`}>
              {gridRows.map((row, r) =>
                row.map((cell, c) => {
                  const key = `${r}-${c}`;
                  const isWin = highlighted.has(key);
                  return (
                    <div
                      key={`${key}-${dropTick}`}
                      className={`cell drop-in ${isWin ? 'win' : ''}`}
                      style={{
                        '--accent': cell.color,
                        '--drop-delay': `${r * 45 + c * 12}ms`,
                      }}
                    >
                      <span className="symbol-icon">{cell.icon}</span>
                      <small className="symbol-label">{cell.label}</small>
                    </div>
                  );
                })
              )}
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
