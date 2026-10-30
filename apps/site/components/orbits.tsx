// Décor du haut des fonctionnalités, à la manière de Hex : arcs de grands cercles de part et
// d'autre du titre, avec les logos des outils autour de la salle (choix du gérant, BRIEF §12),
// des « ? » et de petits carrés. Purement décoratif (aria-hidden), masqué sous `md`.
// Le quadrillage de la page s'efface en fondu sous ce décor (`orbit-fade`, globals.css).

// Repère : viewBox de 1440 × 416, centre des cercles au-dessus du bloc. Les arcs s'arrêtent avant
// la colonne du titre (x de 380 à 1060) pour ne jamais passer derrière le texte.
const CX = 720;
const CY = -200;
const RADII = [460, 600, 740, 880];
const TEXT_LEFT = 380;
const TEXT_RIGHT = 1060;

const point = (radius: number, degrees: number) => {
  const angle = (degrees * Math.PI) / 180;
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
};

/** Arc d'un cercle entre deux angles (degrés, 0 à droite, sens horaire de l'écran). */
function arc(radius: number, from: number, to: number) {
  const start = point(radius, from);
  const end = point(radius, to);
  const sweep = to > from ? 1 : 0;
  return `M${start.x.toFixed(1)} ${start.y.toFixed(1)}A${radius} ${radius} 0 0 ${sweep} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

/** Angle où le cercle atteint l'abscisse x (moitié basse). */
const angleAt = (radius: number, x: number) =>
  (Math.acos(Math.max(-1, Math.min(1, (x - CX) / radius))) * 180) / Math.PI;

const ARCS = RADII.flatMap((radius) => [
  arc(radius, 178, angleAt(radius, TEXT_LEFT)),
  arc(radius, 2, angleAt(radius, TEXT_RIGHT)),
]);

const LOGOS = [
  { src: "/logos/gmail.svg", ...point(600, 150) },
  { src: "/logos/qonto.png", ...point(740, 140) },
  { src: "/logos/chatgpt.svg", ...point(460, 35) },
  { src: "/logos/pennylane.png", ...point(600, 30) },
  { src: "/logos/bsport.png", ...point(740, 40) },
];

const SQUARES = [point(460, 160), point(740, 155), point(600, 135), point(880, 30), point(600, 45)];
const QUESTIONS = [point(460, 150), point(880, 145), point(600, 20), point(740, 25)];

export function Orbits() {
  return (
    <div
      aria-hidden="true"
      className="orbit-fade absolute inset-x-0 top-0 -z-10 hidden h-104 md:block"
    >
      {/* Fond plein sous le décor : le quadrillage de la page s'y efface en fondu. */}
      <div className="absolute inset-0 bg-card" />
      <svg
        viewBox="0 0 1440 416"
        preserveAspectRatio="xMidYMin slice"
        className="absolute inset-0 size-full"
      >
        <defs>
          <filter id="orbit-badge" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx="0"
              dy="1"
              stdDeviation="1.5"
              floodColor="#18181b"
              floodOpacity="0.08"
            />
          </filter>
        </defs>
        <g fill="none" stroke="#18181b" strokeOpacity="0.12">
          {ARCS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g fill="#18181b" fillOpacity="0.16">
          {SQUARES.map(({ x, y }) => (
            <rect key={`${x}-${y}`} x={x - 3} y={y - 3} width="6" height="6" />
          ))}
        </g>
        <g fill="#18181b" fillOpacity="0.35" fontSize="16" fontFamily="inherit" textAnchor="middle">
          {QUESTIONS.map(({ x, y }) => (
            <text key={`${x}-${y}`} x={x} y={y + 5}>
              ?
            </text>
          ))}
        </g>
        {LOGOS.map(({ src, x, y }) => (
          <g key={src} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
            <circle r="22" fill="#ffffff" stroke="#e4e4e7" filter="url(#orbit-badge)" />
            <image href={src} x="-11" y="-11" width="22" height="22" />
          </g>
        ))}
      </svg>
    </div>
  );
}
