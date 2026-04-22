import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

const LOGO_URL =
  'https://axeefndebatrmgqzncuo.supabase.co/storage/v1/object/public/empresa/Editable%20Emporium%20logo%20transparente%20.png'

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
          padding: 4,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_URL}
          width={24}
          height={24}
          style={{ objectFit: 'contain' }}
        />
      </div>
    ),
    { ...size },
  )
}
