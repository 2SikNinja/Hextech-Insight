import Image from 'next/image'

interface GameImageProps {
  src: string | null
  alt: string
  size: number
  title?: string
  className?: string
  rounded?: boolean
}

/**
 * Icon from Riot's Data Dragon CDN. Renders an empty slot when there is no image
 * (an empty item slot, for example), so rows keep their alignment.
 */
export function GameImage({ src, alt, size, title, className = '', rounded = false }: GameImageProps) {
  const shape = rounded ? 'rounded-full' : 'rounded-[3px]'

  if (!src) {
    return (
      <span
        aria-hidden
        className={`inline-block shrink-0 bg-abyss/70 ring-1 ring-line ${shape} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      title={title ?? (alt || undefined)}
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 bg-abyss ${shape} ${className}`}
    />
  )
}
