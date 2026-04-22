import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'linear-gradient(145deg, #0D9488, #0f766e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          fontSize: 20,
          fontWeight: 900,
          color: 'white',
          letterSpacing: '-1px',
        }}
      >
        E
      </div>
    ),
    { ...size },
  )
}
