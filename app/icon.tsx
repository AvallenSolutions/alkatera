import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 100 100" fill="none" width="28" height="28">
          <path d="M50 10L90 80H10L50 10Z" stroke="#ccff00" strokeWidth="2" opacity="0.3" />
          <path d="M50 10C50 10 30 40 30 60C30 71.0457 38.9543 80 50 80C61.0457 80 70 71.0457 70 60C70 40 50 10 50 10Z" stroke="#ccff00" strokeWidth="3" strokeLinejoin="round" />
          <path d="M50 10V80" stroke="#ccff00" strokeWidth="2" strokeLinecap="round" />
          <path d="M50 40L70 25" stroke="#ccff00" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M50 55L30 45" stroke="#ccff00" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
