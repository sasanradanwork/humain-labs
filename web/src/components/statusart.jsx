// The scene across the foot of the status page: the lab behind the platform.
// Drawn here rather than shipped as a picture so it stays sharp at any width, follows the
// theme, and costs nothing to download. Every colour is a variable set in the stylesheet.

const RIG = "var(--art-rig)";
const EDGE = "var(--art-edge)";
const SLOT = "var(--art-slot)";
const BODY = "var(--art-body)";
const COAT = "var(--art-coat)";
const GLASS = "var(--art-glass)";
const WARM = "var(--art-hat)";

// A figure in a lab coat, drawn as flat shapes with no face: the scene is about the work,
// and faces at this size turn into noise. Origin sits at the feet.
function Person({ x, y, s = 1, flip = false, pose = "stand" }) {
  const arm = {
    stand: "M-14 -52 q -8 15 -5 27",
    point: "M14 -52 q 17 2 24 -8",
    hold: "M14 -52 q 12 9 4 18",
    type: "M14 -52 q 14 6 11 17",
    alert: "M14 -54 q 15 -6 14 -22",
  }[pose];
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-10 -26 h 7 l 1 26 h -8 z M3 -26 h 7 l 1 26 h -8 z" fill={BODY} />
      {/* the coat, flaring a little to the hem */}
      <path d="M0 -70 q -16 0 -17 15 l -4 31 q 21 6 42 0 l -4 -31 q -1 -15 -17 -15 z" fill={COAT} />
      <path d="M0 -70 q -5 0 -8 3 l 8 11 l 8 -11 q -3 -3 -8 -3 z" fill={BODY} opacity=".4" />
      <g fill="none" stroke={COAT} strokeWidth="7.5" strokeLinecap="round">
        <path d={arm} />
      </g>
      <circle cx="0" cy="-80" r="11" fill={BODY} />
      <path d="M-11 -83 q 2 -11 11 -11 q 9 0 11 11 q -11 -5 -22 0 z" fill={BODY} opacity=".5" />
    </g>
  );
}

// A flask, the mark the whole site is built around.
function Flask({ x, y, s = 1, fill = GLASS }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-5 -34 V -12 L -20 10 a 8 8 0 0 0 7 12 H 13 a 8 8 0 0 0 7 -12 L 5 -12 V -34 z" fill={SLOT} stroke={EDGE} strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M-13 2 H 13 l 6 9 a 6 6 0 0 1 -5 11 H -12 a 6 6 0 0 1 -5 -11 z" fill={fill} opacity=".85" />
      <path d="M-8 -36 H 8" stroke={EDGE} strokeWidth="4" strokeLinecap="round" />
      <circle cx="-3" cy="9" r="2.2" fill={SLOT} opacity=".5" />
      <circle cx="5" cy="14" r="1.7" fill={SLOT} opacity=".45" />
    </g>
  );
}

// A small badge that floats above the bench, marking each stage of the story.
function Badge({ x, y, tone, children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle cx="0" cy="0" r="21" fill="var(--art-card)" stroke={tone} strokeWidth="2.4" />
      {children}
    </g>
  );
}

export function StatusArt() {
  const RED = "#E05252";
  const GREEN = "#3FBF72";
  return (
    <div className="status-art" aria-hidden="true">
      <svg viewBox="0 0 1200 250" preserveAspectRatio="xMidYMax meet" focusable="false">
        {/* left to right: something breaks, it gets fixed, it comes good */}

        {/* 1. the error is raised */}
        <Badge x={178} y={112} tone={RED}>
          <path d="M0 -9 V 2 M0 7 h .01" stroke={RED} strokeWidth="3.4" strokeLinecap="round" />
        </Badge>
        <rect x="104" y="146" width="130" height="60" rx="8" fill={RIG} stroke={EDGE} strokeWidth="2.2" />
        <rect x="115" y="156" width="108" height="40" rx="4" fill={SLOT} />
        <path d="M126 164 l 22 18 l 18 -12 l 26 22" fill="none" stroke={RED} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <Person x={296} y={250} s={1.42} pose="alert" flip />

        {/* 2. it is being fixed */}
        <Person x={470} y={250} s={1.46} pose="point" />
        <Badge x={610} y={116} tone={WARM}>
          <circle cx="0" cy="0" r="7" fill="none" stroke={WARM} strokeWidth="3" />
          <g stroke={WARM} strokeWidth="3" strokeLinecap="round">
            {[0, 45, 90, 135].map((a) => (
              <path key={a} d="M0 -11.5 V -8 M0 8 V 11.5" transform={`rotate(${a})`} />
            ))}
          </g>
        </Badge>
        <rect x="556" y="148" width="112" height="58" rx="8" fill={RIG} stroke={EDGE} strokeWidth="2.2" />
        <rect x="566" y="158" width="44" height="38" rx="4" fill={SLOT} />
        <path d="M612 158 l 22 -14 v 38 l -22 14 z" fill={SLOT} stroke={EDGE} strokeWidth="2" strokeLinejoin="round" opacity=".9" />
        <circle cx="644" cy="196" r="3.4" fill={WARM} />
        <Flask x={712} y={181} s={1.08} fill={WARM} />
        <Person x={800} y={250} s={1.44} pose="hold" flip />

        {/* 3. everything is sorted */}
        <Person x={932} y={250} s={1.38} pose="stand" />
        <Badge x={1052} y={110} tone={GREEN}>
          <path d="M-8 1 l 6 6 l 11 -13" fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
        </Badge>
        <rect x="990" y="142" width="122" height="64" rx="8" fill={RIG} stroke={EDGE} strokeWidth="2.2" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <rect x="1002" y={152 + i * 18} width="98" height="12" rx="4" fill={SLOT} />
            <circle cx={1090} cy={158 + i * 18} r="3" fill={GREEN} />
            <path d={`M1012 ${158 + i * 18} h 40`} stroke={EDGE} strokeWidth="2.2" strokeLinecap="round" />
          </g>
        ))}

        {/* the bench, drawn over the people so they stand behind it */}
        <rect x="-10" y="206" width="1220" height="44" fill={RIG} />
        <rect x="-10" y="200" width="1220" height="11" rx="5.5" fill={SLOT} stroke={EDGE} strokeWidth="2.2" />
        <g stroke={EDGE} strokeWidth="2" opacity=".4">
          <path d="M360 215 V 250 M860 215 V 250" />
        </g>
      </svg>
    </div>
  );
}
