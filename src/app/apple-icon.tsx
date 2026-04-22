import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: 'linear-gradient(145deg, #0D9488 0%, #0f766e 55%, #115e59 100%)',
          borderRadius: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Highlight */}
        <div
          style={{
            position: 'absolute',
            top: 11,
            left: 11,
            right: 11,
            height: '42%',
            background: 'rgba(255,255,255,0.13)',
            borderRadius: 26,
          }}
        />
        <span
          style={{
            fontFamily: 'sans-serif',
            fontSize: 96,
            fontWeight: 900,
            color: 'white',
            letterSpacing: '-6px',
            lineHeight: 1,
            textShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          E
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  )
}
