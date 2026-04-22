import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const LOGO_URL =
  'https://axeefndebatrmgqzncuo.supabase.co/storage/v1/object/public/empresa/Editable%20Emporium%20logo%20transparente%20.png'

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
          padding: 24,
          position: 'relative',
        }}
      >
        {/* Highlight gloss */}
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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_URL}
          width={132}
          height={132}
          style={{ objectFit: 'contain', position: 'relative', zIndex: 1 }}
        />
      </div>
    ),
    { width: 180, height: 180 },
  )
}
