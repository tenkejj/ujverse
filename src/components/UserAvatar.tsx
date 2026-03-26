import type { Profile } from '../types'

type Props = {
  profile?: Profile | null
  name: string
  className?: string
  textSize?: string
}

export default function UserAvatar({
  profile,
  name,
  className = 'h-10 w-10',
  textSize = 'text-sm',
}: Props) {
  const init = (profile?.full_name ?? name).charAt(0).toUpperCase()
  return profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={name}
      className={`rounded-full object-cover object-center shrink-0 ${className}`}
    />
  ) : (
    <div
      className={`rounded-full bg-uj-blue/10 flex items-center justify-center shrink-0 ${className}`}
    >
      <span className={`${textSize} font-bold text-uj-blue`}>{init}</span>
    </div>
  )
}
