/**
 * Дорожные знаки для вопросов ПДД — рисуем сами в SVG (viewBox 100×100),
 * без картинок: лёгкие, чёткие на любом экране, не зависят от темы.
 *
 * Код — номер знака по ПДД КР, через двоеточие параметр: число на знаке
 * ограничения скорости ('3.24:40') или название населённого пункта
 * ('5.23.1:БИШКЕК'). Только знаки с простой геометрией — пиктограммы
 * (пешеход, дети, поезд) в SVG от руки выглядели бы неточно, такие
 * вопросы формулируем текстом.
 */
const RED = '#D7262B'
const BLUE = '#1F5FBF'
const YELLOW = '#F6C400'
const INK = '#1A1A1A'
const GRAY = '#7A7A7A'

const ring = (fill = '#fff') => <circle cx="50" cy="50" r="42" fill={fill} stroke={RED} strokeWidth="10" />
const slash = <line x1="22" y1="22" x2="78" y2="78" stroke={RED} strokeWidth="8" />
const triangle = (
  <>
    <polygon points="50,6 96,88 4,88" fill={RED} strokeLinejoin="round" />
    <polygon points="50,24 81,79 19,79" fill="#fff" />
  </>
)
const arrowHead = (x, y, dir, color, size = 12) => {
  const s = size
  const pts = {
    up: `${x},${y - s} ${x - s},${y + 2} ${x + s},${y + 2}`,
    right: `${x + s},${y} ${x - 2},${y - s} ${x - 2},${y + s}`,
    left: `${x - s},${y} ${x + 2},${y - s} ${x + 2},${y + s}`,
    down: `${x},${y + s} ${x - s},${y - 2} ${x + s},${y - 2}`,
  }[dir]
  return <polygon points={pts} fill={color} />
}

function endStripes(color) {
  // Диагональ «/» из нескольких тонких полос — знаки «конец ограничения».
  return (
    <g stroke={color} strokeWidth="2.5">
      {[-9, -3, 3, 9].map((d) => (
        <line key={d} x1={22 + d} y1={78 + d} x2={78 + d} y2={22 + d} />
      ))}
    </g>
  )
}

const SIGNS = {
  '1.33': () => (
    <>
      {triangle}
      <rect x="46" y="40" width="8" height="24" rx="2" fill={INK} />
      <circle cx="50" cy="71" r="4.5" fill={INK} />
    </>
  ),
  '2.1': () => (
    <>
      <polygon points="50,3 97,50 50,97 3,50" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <polygon points="50,17 83,50 50,83 17,50" fill={YELLOW} />
    </>
  ),
  '2.2': () => (
    <>
      <polygon points="50,3 97,50 50,97 3,50" fill="#fff" stroke={INK} strokeWidth="1.5" />
      <polygon points="50,17 83,50 50,83 17,50" fill={YELLOW} />
      <g stroke={INK} strokeWidth="3">
        {[-6, 0, 6].map((d) => (
          <line key={d} x1={28 + d} y1={72 + d} x2={72 + d} y2={28 + d} />
        ))}
      </g>
    </>
  ),
  '2.3.1': () => (
    <>
      {triangle}
      <rect x="44" y="36" width="12" height="40" fill={INK} />
      <rect x="30" y="55" width="40" height="4" fill={INK} />
    </>
  ),
  '2.4': () => (
    <>
      <polygon points="4,12 96,12 50,94" fill={RED} strokeLinejoin="round" />
      <polygon points="21,21 79,21 50,76" fill="#fff" />
    </>
  ),
  '2.5': () => (
    <>
      <polygon
        points="92.5,67.6 67.6,92.5 32.4,92.5 7.5,67.6 7.5,32.4 32.4,7.5 67.6,7.5 92.5,32.4"
        fill={RED}
        stroke="#fff"
        strokeWidth="2.5"
      />
      <text x="50" y="59" textAnchor="middle" fontSize="25" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">
        STOP
      </text>
    </>
  ),
  '3.1': () => (
    <>
      <circle cx="50" cy="50" r="47" fill={RED} />
      <rect x="16" y="42" width="68" height="16" fill="#fff" />
    </>
  ),
  '3.2': () => ring(),
  '3.18.1': () => (
    <>
      {ring()}
      <path d="M42 72 V48 H63" fill="none" stroke={INK} strokeWidth="7" />
      {arrowHead(64, 48, 'right', INK, 10)}
      {slash}
    </>
  ),
  '3.18.2': () => (
    <>
      {ring()}
      <path d="M58 72 V48 H37" fill="none" stroke={INK} strokeWidth="7" />
      {arrowHead(36, 48, 'left', INK, 10)}
      {slash}
    </>
  ),
  '3.19': () => (
    <>
      {ring()}
      <path d="M58 74 V44 A10 10 0 0 0 38 44 V58" fill="none" stroke={INK} strokeWidth="7" />
      {arrowHead(38, 62, 'down', INK, 10)}
      {slash}
    </>
  ),
  '3.24': (value = '40') => (
    <>
      {ring()}
      <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="800" fill={INK} fontFamily="Arial, sans-serif">
        {value}
      </text>
    </>
  ),
  '3.25': (value = '40') => (
    <>
      <circle cx="50" cy="50" r="45" fill="#fff" stroke={GRAY} strokeWidth="2" />
      <text x="50" y="62" textAnchor="middle" fontSize="34" fontWeight="800" fill={GRAY} fontFamily="Arial, sans-serif">
        {value}
      </text>
      {endStripes(INK)}
    </>
  ),
  '3.27': () => (
    <>
      {ring(BLUE)}
      <line x1="22" y1="22" x2="78" y2="78" stroke={RED} strokeWidth="8" />
      <line x1="78" y1="22" x2="22" y2="78" stroke={RED} strokeWidth="8" />
    </>
  ),
  '3.28': () => (
    <>
      {ring(BLUE)}
      {slash}
    </>
  ),
  '3.31': () => (
    <>
      <circle cx="50" cy="50" r="45" fill="#fff" stroke={GRAY} strokeWidth="2" />
      {endStripes(INK)}
    </>
  ),
  '4.1.1': () => (
    <>
      <circle cx="50" cy="50" r="47" fill={BLUE} />
      <rect x="45" y="30" width="10" height="50" fill="#fff" />
      {arrowHead(50, 30, 'up', '#fff', 16)}
    </>
  ),
  '4.1.2': () => (
    <>
      <circle cx="50" cy="50" r="47" fill={BLUE} />
      <path d="M40 80 V52 A8 8 0 0 1 48 44 H67" fill="none" stroke="#fff" strokeWidth="10" />
      {arrowHead(68, 44, 'right', '#fff', 15)}
    </>
  ),
  '5.5': () => (
    <>
      <rect x="4" y="4" width="92" height="92" rx="8" fill={BLUE} stroke="#fff" strokeWidth="3" />
      <rect x="45" y="30" width="10" height="54" fill="#fff" />
      {arrowHead(50, 30, 'up', '#fff', 17)}
    </>
  ),
  '5.23.1': (name = 'БИШКЕК') => (
    <>
      <rect x="2" y="26" width="96" height="48" rx="4" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <text x="50" y="57" textAnchor="middle" fontSize={name.length > 8 ? 12 : 15} fontWeight="800" fill={INK} fontFamily="Arial, sans-serif">
        {name}
      </text>
    </>
  ),
  '5.24.1': (name = 'БИШКЕК') => (
    <>
      <rect x="2" y="26" width="96" height="48" rx="4" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <text x="50" y="57" textAnchor="middle" fontSize={name.length > 8 ? 12 : 15} fontWeight="800" fill={INK} fontFamily="Arial, sans-serif">
        {name}
      </text>
      <line x1="8" y1="70" x2="92" y2="30" stroke={RED} strokeWidth="5" />
    </>
  ),
  '6.4': () => (
    <>
      <rect x="4" y="4" width="92" height="92" rx="8" fill={BLUE} stroke="#fff" strokeWidth="3" />
      <text x="50" y="76" textAnchor="middle" fontSize="66" fontWeight="800" fill="#fff" fontFamily="Arial, sans-serif">
        P
      </text>
    </>
  ),
}

export const SIGN_CODES = Object.keys(SIGNS)

/** '3.24:40' -> { code: '3.24', param: '40' } */
export function parseSign(sign) {
  if (!sign) return null
  const i = sign.indexOf(':')
  return i === -1 ? { code: sign, param: undefined } : { code: sign.slice(0, i), param: sign.slice(i + 1) }
}

export default function PddSign({ sign, size = 120, className = '' }) {
  const parsed = parseSign(sign)
  const draw = parsed && SIGNS[parsed.code]
  if (!draw) return null
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={`Дорожный знак ${parsed.code}`}
      className={`drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] ${className}`}
    >
      {draw(parsed.param)}
    </svg>
  )
}
