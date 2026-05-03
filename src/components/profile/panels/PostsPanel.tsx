import { MessageCircle } from 'lucide-react'
import type { ComponentProps } from 'react'
import EmptyState from '../../EmptyState'
import PostList from './PostList'

type Props = ComponentProps<typeof PostList> & {
  loading: boolean
  isOwn: boolean
}

export default function PostsPanel({ loading, isOwn, ...rest }: Props) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#1e293b] dark:border-brand-gold-bright border-t-transparent" />
      </div>
    )
  }

  if (rest.list.length === 0) {
    if (isOwn) {
      return (
        <div className="flex flex-col items-center py-12 text-slate-400">
          <MessageCircle size={36} className="mb-3 opacity-20" />
          <p className="text-sm">Nie masz jeszcze żadnych wpisów.</p>
        </div>
      )
    }
    return (
      <EmptyState
        icon={MessageCircle}
        title="Brak wpisów"
        subtitle="Ten użytkownik nie opublikował jeszcze żadnych postów"
      />
    )
  }

  return <PostList {...rest} />
}
