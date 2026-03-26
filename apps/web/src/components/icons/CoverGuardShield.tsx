export function CoverGuardShield({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="cg-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="cg-blue" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      {/* Left shield half — green */}
      <path
        d="M32 4L8 16v16c0 14 10 24 24 28V32l-8-6V16l8-4V4z"
        fill="url(#cg-green)"
      />
      {/* Right shield half — blue */}
      <path
        d="M32 4l24 12v16c0 14-10 24-24 28V32l8-6V16l-8-4V4z"
        fill="url(#cg-blue)"
      />
      {/* Inner cutout / dark accent */}
      <path
        d="M32 20l-8 6v8l8 10 8-10v-8l-8-6z"
        fill="#0f172a"
        opacity="0.6"
      />
    </svg>
  )
}
