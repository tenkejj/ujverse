import { Camera } from 'lucide-react'
import type { ComponentProps } from 'react'
import EmptyState from '../../EmptyState'
import PostList from './PostList'

type Props = ComponentProps<typeof PostList> & {
  loading: boolean
  isOwn: boolean
}

export default function MediaPanel({ loading, isOwn, ...rest }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[var(--profile-accent)] border-t-transparent" />
      </div>
    )
  }

  if (rest.list.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="Brak multimediów"
        subtitle={
          isOwn
            ? 'Opublikuj wpis ze zdjęciem, aby pojawiło się tutaj.'
            : 'Brak wpisów ze zdjęciami.'
        }
      />
    )
  }

  return <PostList {...rest} />
}
