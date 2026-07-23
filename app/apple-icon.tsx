import { ImageResponse } from 'next/og'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

// The design-system favicon at apple-touch size: cream leaf-drop on the
// forest tile, veins in forest. Geometry scaled 32 -> 180 (x5.625);
// iOS applies its own corner mask, so the tile fills the canvas.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#205E40',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 32 32" width="180" height="180">
          <path
            d="M16 6 C 20.5 13 24 15.5 24 19 A 8 8 0 1 1 8 19 C 8 15.5 11.5 13 16 6 Z"
            fill="#F2F1EA"
          />
          <line x1="16" y1="10" x2="16" y2="26" stroke="#205E40" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="16" y1="18.5" x2="20" y2="14.5" stroke="#205E40" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="16" y1="18.5" x2="12" y2="14.5" stroke="#205E40" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
