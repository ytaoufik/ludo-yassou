/**
 * board-renderer.js
 * Renders the Ludo board using SVG elements.
 * Handles board drawing, token placement, and animations.
 */

// Board configuration
const CELL_SIZE = 50;
const BOARD_CELLS = 15; // 15x15 grid
const OFFSET = 0; // SVG offset

// Color definitions for each player
const PLAYER_COLORS = {
  red:    { fill: '#e74c3c', light: '#ff6b6b', dark: '#c0392b', home: '#fdcbcb' },
  blue:   { fill: '#3498db', light: '#74b9ff', dark: '#2980b9', home: '#c8e6ff' },
  green:  { fill: '#2ecc71', light: '#55efc4', dark: '#27ae60', home: '#c8f7dc' },
  yellow: { fill: '#f1c40f', light: '#ffeaa7', dark: '#f39c12', home: '#fff5cc' }
};

/**
 * Maps each cell index (0-51) on the main track to (x, y) pixel coordinates.
 * The Ludo board track goes clockwise starting from red's start.
 */
const TRACK_POSITIONS = computeTrackPositions();

function computeTrackPositions() {
  const positions = [];
  const S = CELL_SIZE;

  // The 52-cell track laid out on a 15x15 grid
  // Each quadrant has 13 cells. We trace the path clockwise.
  // Starting from cell 0 (red start area, col=1, row=6 in grid coords)

  // Bottom of left column, going up (red approach + blue start)
  // Cells 0-4: bottom-left vertical going up
  const trackCoords = [
    // Cells 0-5: Left column going UP (col=6, rows 13→8)
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [6, 8],
    // Cells 6-7: Turn right at top (row=7, cols 5→4... no)
    // Let me define the standard Ludo path properly.
    // Actually, let me use the standard 15x15 grid coordinates:
  ];

  // Standard Ludo track (52 cells), using [col, row] in a 15x15 grid (0-indexed)
  const stdTrack = [
    // Red start zone → going UP along left-center column
    [6, 13], [6, 12], [6, 11], [6, 10], [6, 9], [6, 8],
    // Turn right along top-center row
    [5, 7], [4, 7], [3, 7], [2, 7], [1, 7], [0, 7],
    // Go up to blue corner
    [0, 6],
    // Blue start zone → going RIGHT along top-center row
    [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
    // Turn down
    [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
    // Go right to green corner
    [7, 0],
    // Green → going DOWN along right-center column
    [8, 0], // Cell 26 = green start
    [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    // Turn right
    [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
    // Go down
    [14, 7],
    // Yellow → going LEFT along bottom-center row
    [14, 8], // Cell 39 = yellow start (but let me recount)
    [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
    // Turn up
    [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
    // Go left
    [7, 14],
    // Back toward red
    [6, 14]
  ];

  for (const [col, row] of stdTrack) {
    positions.push({
      x: col * S + S / 2,
      y: row * S + S / 2
    });
  }

  return positions;
}

/**
 * Home stretch positions for each color (6 cells each).
 * These are the colored paths leading to the center.
 */
const HOME_STRETCH_POSITIONS = {
  red: [
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 13 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 12 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 11 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 10 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 9 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 8 * CELL_SIZE + CELL_SIZE/2 },
  ],
  blue: [
    { x: 1 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 2 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 3 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 4 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 5 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 6 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
  ],
  green: [
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 1 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 2 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 3 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 4 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 5 * CELL_SIZE + CELL_SIZE/2 },
    { x: 7 * CELL_SIZE + CELL_SIZE/2, y: 6 * CELL_SIZE + CELL_SIZE/2 },
  ],
  yellow: [
    { x: 13 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 12 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 11 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 10 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 9 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
    { x: 8 * CELL_SIZE + CELL_SIZE/2, y: 7 * CELL_SIZE + CELL_SIZE/2 },
  ]
};

/**
 * Base/yard positions for tokens waiting to enter the game.
 * Each color has 4 token positions in their yard.
 */
const BASE_POSITIONS = {
  red: [
    { x: 2 * CELL_SIZE, y: 11 * CELL_SIZE },
    { x: 4 * CELL_SIZE, y: 11 * CELL_SIZE },
    { x: 2 * CELL_SIZE, y: 13 * CELL_SIZE },
    { x: 4 * CELL_SIZE, y: 13 * CELL_SIZE }
  ],
  blue: [
    { x: 2 * CELL_SIZE, y: 2 * CELL_SIZE },
    { x: 4 * CELL_SIZE, y: 2 * CELL_SIZE },
    { x: 2 * CELL_SIZE, y: 4 * CELL_SIZE },
    { x: 4 * CELL_SIZE, y: 4 * CELL_SIZE }
  ],
  green: [
    { x: 11 * CELL_SIZE, y: 2 * CELL_SIZE },
    { x: 13 * CELL_SIZE, y: 2 * CELL_SIZE },
    { x: 11 * CELL_SIZE, y: 4 * CELL_SIZE },
    { x: 13 * CELL_SIZE, y: 4 * CELL_SIZE }
  ],
  yellow: [
    { x: 11 * CELL_SIZE, y: 11 * CELL_SIZE },
    { x: 13 * CELL_SIZE, y: 11 * CELL_SIZE },
    { x: 11 * CELL_SIZE, y: 13 * CELL_SIZE },
    { x: 13 * CELL_SIZE, y: 13 * CELL_SIZE }
  ]
};

// Safe positions on the track (star cells)
const SAFE_POSITIONS = [0, 8, 13, 21, 26, 34, 39, 47];

/**
 * Draws the full Ludo board into the SVG element.
 */
export function drawBoard(svgEl) {
  svgEl.innerHTML = '';
  const S = CELL_SIZE;

  // Background
  const bg = createSVGElement('rect', {
    x: 0, y: 0, width: 750, height: 750,
    fill: '#16213e', rx: 8
  });
  svgEl.appendChild(bg);

  // Draw the 4 colored home yards (corners)
  drawYard(svgEl, 0, 0, 'blue');        // Top-left
  drawYard(svgEl, 9 * S, 0, 'green');    // Top-right
  drawYard(svgEl, 0, 9 * S, 'red');      // Bottom-left
  drawYard(svgEl, 9 * S, 9 * S, 'yellow'); // Bottom-right

  // Draw the track cells
  for (let i = 0; i < TRACK_POSITIONS.length; i++) {
    const pos = TRACK_POSITIONS[i];
    const isSafe = SAFE_POSITIONS.includes(i);

    // Determine cell color
    let cellColor = '#e8e8e8';
    if (i === 0)  cellColor = PLAYER_COLORS.red.light;
    if (i === 13) cellColor = PLAYER_COLORS.blue.light;
    if (i === 26) cellColor = PLAYER_COLORS.green.light;
    if (i === 39) cellColor = PLAYER_COLORS.yellow.light;

    const cell = createSVGElement('rect', {
      x: pos.x - S/2 + 1,
      y: pos.y - S/2 + 1,
      width: S - 2,
      height: S - 2,
      fill: cellColor,
      rx: 4,
      stroke: '#2c3e50',
      'stroke-width': 0.5
    });
    svgEl.appendChild(cell);

    // Draw star marker on safe cells
    if (isSafe) {
      const star = createSVGElement('text', {
        x: pos.x,
        y: pos.y + 4,
        'text-anchor': 'middle',
        'font-size': '16',
        fill: '#555',
        'pointer-events': 'none'
      });
      star.textContent = '★';
      svgEl.appendChild(star);
    }
  }

  // Draw home stretch columns
  for (const color of ['red', 'blue', 'green', 'yellow']) {
    const cols = PLAYER_COLORS[color];
    HOME_STRETCH_POSITIONS[color].forEach((pos, idx) => {
      const cell = createSVGElement('rect', {
        x: pos.x - S/2 + 1,
        y: pos.y - S/2 + 1,
        width: S - 2,
        height: S - 2,
        fill: cols.home,
        rx: 4,
        stroke: cols.fill,
        'stroke-width': 1
      });
      svgEl.appendChild(cell);

      // Final cell (center triangle indicator)
      if (idx === 5) {
        const tri = createSVGElement('text', {
          x: pos.x,
          y: pos.y + 5,
          'text-anchor': 'middle',
          'font-size': '14',
          fill: cols.dark,
          'pointer-events': 'none'
        });
        tri.textContent = '▲';
        svgEl.appendChild(tri);
      }
    });
  }

  // Draw center home triangle
  drawCenter(svgEl);
}

/**
 * Draws a colored yard (corner base) for a player.
 */
function drawYard(svg, x, y, color) {
  const S = CELL_SIZE;
  const cols = PLAYER_COLORS[color];

  // Yard background
  const yard = createSVGElement('rect', {
    x: x + 2, y: y + 2,
    width: 6 * S - 4, height: 6 * S - 4,
    fill: cols.fill,
    rx: 12,
    opacity: 0.3
  });
  svg.appendChild(yard);

  // Yard border
  const border = createSVGElement('rect', {
    x: x + 2, y: y + 2,
    width: 6 * S - 4, height: 6 * S - 4,
    fill: 'none',
    stroke: cols.fill,
    'stroke-width': 2,
    rx: 12
  });
  svg.appendChild(border);

  // Inner white area for tokens
  const inner = createSVGElement('rect', {
    x: x + S, y: y + S,
    width: 4 * S, height: 4 * S,
    fill: '#16213e',
    rx: 10,
    stroke: cols.dark,
    'stroke-width': 1
  });
  svg.appendChild(inner);

  // Token spots (circles)
  const spots = BASE_POSITIONS[color];
  spots.forEach(spot => {
    const circle = createSVGElement('circle', {
      cx: spot.x + S/2,
      cy: spot.y + S/2,
      r: 14,
      fill: cols.light,
      opacity: 0.3,
      stroke: cols.fill,
      'stroke-width': 1
    });
    svg.appendChild(circle);
  });
}

/**
 * Draws the center home area (the finish zone with 4 triangles).
 */
function drawCenter(svg) {
  const S = CELL_SIZE;
  const cx = 7.5 * S;
  const cy = 7.5 * S;
  const size = 1.5 * S;

  // Center background
  const centerBg = createSVGElement('rect', {
    x: cx - size, y: cy - size,
    width: size * 2, height: size * 2,
    fill: '#1a1a2e',
    rx: 4
  });
  svg.appendChild(centerBg);

  // Four colored triangles pointing to center
  const triangles = [
    { color: 'red',    points: `${cx},${cy} ${cx - size},${cy + size} ${cx + size},${cy + size}` },
    { color: 'blue',   points: `${cx},${cy} ${cx - size},${cy - size} ${cx - size},${cy + size}` },
    { color: 'green',  points: `${cx},${cy} ${cx - size},${cy - size} ${cx + size},${cy - size}` },
    { color: 'yellow', points: `${cx},${cy} ${cx + size},${cy - size} ${cx + size},${cy + size}` }
  ];

  triangles.forEach(({ color, points }) => {
    const tri = createSVGElement('polygon', {
      points,
      fill: PLAYER_COLORS[color].fill,
      opacity: 0.6,
      stroke: '#fff',
      'stroke-width': 1
    });
    svg.appendChild(tri);
  });

  // Center circle
  const dot = createSVGElement('circle', {
    cx, cy, r: 12,
    fill: '#fff',
    stroke: '#333',
    'stroke-width': 1
  });
  svg.appendChild(dot);
}

/**
 * Renders all tokens on the board based on the game state.
 * Returns an array of token elements for click handling.
 */
export function renderTokens(svgEl, gameState, validMoves, onTokenClick) {
  // Remove existing tokens
  svgEl.querySelectorAll('.game-token').forEach(el => el.remove());

  const tokenElements = [];
  const S = CELL_SIZE;

  gameState.players.forEach((player, playerIndex) => {
    const color = player.color;
    const cols = PLAYER_COLORS[color];

    player.tokens.forEach((token, tokenIndex) => {
      let pos;
      let isClickable = false;

      if (token.finished) {
        // Token is in the center (finished)
        pos = { x: 7.5 * S, y: 7.5 * S };
        // Stack finished tokens slightly offset
        pos.x += (tokenIndex - 1.5) * 10;
      } else if (token.position === -1) {
        // Token is in base/yard
        const base = BASE_POSITIONS[color][tokenIndex];
        pos = { x: base.x + S/2, y: base.y + S/2 };
      } else if (token.homeProgress >= 0) {
        // Token is in home stretch
        pos = HOME_STRETCH_POSITIONS[color][token.homeProgress];
      } else {
        // Token is on the main track
        pos = TRACK_POSITIONS[token.position];
      }

      if (!pos) return;

      // Check if this token has a valid move
      if (validMoves) {
        isClickable = validMoves.some(m => m.tokenIndex === tokenIndex);
      }

      // Create token group
      const g = createSVGElement('g', {
        class: `game-token ${isClickable ? 'clickable' : ''}`,
        'data-player': playerIndex,
        'data-token': tokenIndex,
        transform: `translate(${pos.x}, ${pos.y})`
      });

      // Glow for clickable tokens
      if (isClickable) {
        const glow = createSVGElement('circle', {
          cx: 0, cy: 0, r: 20,
          fill: cols.light,
          opacity: 0.3,
          class: 'token-glow'
        });
        g.appendChild(glow);

        // Pulsing animation ring
        const ring = createSVGElement('circle', {
          cx: 0, cy: 0, r: 18,
          fill: 'none',
          stroke: cols.light,
          'stroke-width': 2,
          opacity: 0.6,
          class: 'token-pulse-ring'
        });
        g.appendChild(ring);
      }

      // Token body (outer circle)
      const outer = createSVGElement('circle', {
        cx: 0, cy: 0, r: 15,
        fill: cols.fill,
        stroke: '#fff',
        'stroke-width': 2,
        filter: 'url(#tokenShadow)'
      });
      g.appendChild(outer);

      // Inner circle
      const inner = createSVGElement('circle', {
        cx: 0, cy: 0, r: 8,
        fill: cols.light,
        opacity: 0.6
      });
      g.appendChild(inner);

      // Token number
      const label = createSVGElement('text', {
        x: 0, y: 4,
        'text-anchor': 'middle',
        'font-size': '10',
        'font-weight': 'bold',
        fill: '#fff',
        'pointer-events': 'none'
      });
      label.textContent = tokenIndex + 1;
      g.appendChild(label);

      if (isClickable && onTokenClick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => onTokenClick(tokenIndex));
      }

      svgEl.appendChild(g);
      tokenElements.push(g);
    });
  });

  // Add SVG filter for token shadow (only once)
  if (!svgEl.querySelector('#tokenShadow')) {
    const defs = createSVGElement('defs', {});
    defs.innerHTML = `
      <filter id="tokenShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
      </filter>
    `;
    svgEl.prepend(defs);
  }

  return tokenElements;
}

/**
 * Animate a token moving from one position to another.
 */
export function animateTokenMove(svgEl, playerIndex, tokenIndex, fromPos, toPos, duration = 400) {
  return new Promise(resolve => {
    const token = svgEl.querySelector(
      `.game-token[data-player="${playerIndex}"][data-token="${tokenIndex}"]`
    );
    if (!token) { resolve(); return; }

    token.style.transition = `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    token.setAttribute('transform', `translate(${toPos.x}, ${toPos.y})`);

    setTimeout(resolve, duration);
  });
}

/**
 * Get position coordinates for a token based on game state.
 */
export function getTokenPosition(token, color, tokenIndex) {
  const S = CELL_SIZE;
  if (token.finished) {
    return { x: 7.5 * S + (tokenIndex - 1.5) * 10, y: 7.5 * S };
  }
  if (token.position === -1) {
    const base = BASE_POSITIONS[color][tokenIndex];
    return { x: base.x + S/2, y: base.y + S/2 };
  }
  if (token.homeProgress >= 0) {
    return HOME_STRETCH_POSITIONS[color][token.homeProgress];
  }
  return TRACK_POSITIONS[token.position];
}

// SVG element helper
function createSVGElement(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el;
}

// Add CSS for token animations
const tokenStyles = document.createElement('style');
tokenStyles.textContent = `
  .game-token {
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .game-token.clickable {
    cursor: pointer;
  }
  .game-token.clickable:hover circle:first-child {
    opacity: 0.5;
  }
  .token-pulse-ring {
    animation: tokenPulse 1.5s ease-in-out infinite;
  }
  .token-glow {
    animation: tokenGlow 1.5s ease-in-out infinite;
  }
  @keyframes tokenPulse {
    0%, 100% { r: 18; opacity: 0.6; }
    50% { r: 22; opacity: 0.2; }
  }
  @keyframes tokenGlow {
    0%, 100% { r: 20; opacity: 0.3; }
    50% { r: 24; opacity: 0.1; }
  }
`;
document.head.appendChild(tokenStyles);

export { TRACK_POSITIONS, HOME_STRETCH_POSITIONS, BASE_POSITIONS, PLAYER_COLORS };
