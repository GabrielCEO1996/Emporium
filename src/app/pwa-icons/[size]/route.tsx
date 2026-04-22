import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(
  _req: Request,
  { params }: { params: { size: string } }
) {
  const size = parseInt(params.size, 10) || 192
  const radius = Math.round(size * 0.22)
  const fontSize = Math.round(size * 0.52)
  const letterSpacing = Math.round(size * -0.04)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(145deg, #0D9488 0%, #0f766e 55%, #115e59 100%)',
          borderRadius: radius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Subtle inner highlight */}
        <div
          style={{
            position: 'absolute',
            top: size * 0.06,
            left: size * 0.06,
            right: size * 0.06,
            height: '45%',
            background: 'rgba(255,255,255,0.12)',
            borderRadius: radius * 0.7,
          }}
        />
        <span
          style={{
            fontFamily: 'sans-serif',
            fontSize,
            fontWeight: 900,
            color: 'white',
            letterSpacing,
            lineHeight: 1,
            textShadow: `0 ${size * 0.02}px ${size * 0.06}px rgba(0,0,0,0.25)`,
          }}
        >
          E
        </span>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    }
  )
}
