// Small inline SVG icons — stroke-based, inherit currentColor so they
// pick up the surrounding text color.

function Svg({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
      {...props}
    >
      {children}
    </svg>
  )
}

export function IconCup(props) {
  return (
    <Svg {...props}>
      <path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 5.5c0-1 1-1 1-2M12 5.5c0-1 1-1 1-2" />
    </Svg>
  )
}

export function IconMoon(props) {
  return (
    <Svg {...props}>
      <path d="M18.5 13.5A7.5 7.5 0 0 1 10.5 5.5 7.5 7.5 0 1 0 18.5 13.5z" />
    </Svg>
  )
}

export function IconFork(props) {
  return (
    <Svg {...props}>
      <path d="M7 3v5a2 2 0 0 0 2 2v10" />
      <path d="M5 3v4M11 3v4" />
      <path d="M17 3c-1.5 1.5-2 4-2 6v2h2v9" />
    </Svg>
  )
}

export function IconCamera(props) {
  return (
    <Svg {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
      <circle cx="12" cy="13" r="3.2" />
    </Svg>
  )
}

export function IconBed(props) {
  return (
    <Svg {...props}>
      <path d="M3 18v-7" />
      <path d="M3 15h18v3" />
      <path d="M21 15v-3a3 3 0 0 0-3-3h-8v6" />
      <circle cx="6.5" cy="11.5" r="1.6" />
    </Svg>
  )
}

export function IconCompass(props) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M15.5 8.5 13.5 13.5 8.5 15.5 10.5 10.5z" />
    </Svg>
  )
}
