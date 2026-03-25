import { MessageCircle, Filter, Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Comment, Post, Profile } from '../types'
import ComposeBox from './ComposeBox'
import PostCard from './PostCard'
import DepartmentFilter from './DepartmentFilter'
import EmptyState from './EmptyState'

type Props = {
  myProfile: Profile | null
  displayName: string
  currentUserId: string

  // Compose state
  isComposing: boolean
  createBody: string
  createImageFile: File | null
  createImagePreview: string | null
  createLoading: boolean
  createError: string | null
  onBodyChange: (v: string) => void
  onImageFileChange: (f: File | null) => void
  onComposeOpen: () => void
  onComposeReset: () => void
  onCreatePost: () => void

  // Posts
  posts: Post[]
  postsLoading: boolean
  postsError: string | null

  // Filter
  selectedDepartment: string
  onDepartmentChange: (dept: string) => void
  searchQuery: string

  // Likes
  likesCountByPost: Record<string, number>
  likedPostIds: Record<string, boolean>
  heartPopPostId: string | null

  // Comments
  commentsCountByPost: Record<string, number>
  commentsByPost: Record<string, Comment[]>
  expandedComments: Set<string>
  commentInput: Record<string, string>
  commentSubmitting: Record<string, boolean>

  // Handlers
  onToggleLike: (postId: string) => void
  onToggleComments: (postId: string) => void
  onSubmitComment: (postId: string) => void
  onCommentInputChange: (postId: string, value: string) => void
  onDeletePost: (postId: string) => void
  onDeleteComment: (commentId: number, postId: string) => void
  onNavigateToPost: (postId: string) => void
  onNavigateToUser?: (userId: string) => void
}

export default function FeedView({
  myProfile,
  displayName,
  currentUserId,
  isComposing,
  createBody,
  createImageFile,
  createImagePreview,
  createLoading,
  createError,
  onBodyChange,
  onImageFileChange,
  onComposeOpen,
  onComposeReset,
  onCreatePost,
  posts,
  postsLoading,
  postsError,
  likesCountByPost,
  likedPostIds,
  heartPopPostId,
  commentsCountByPost,
  commentsByPost,
  expandedComments,
  commentInput,
  commentSubmitting,
  onToggleLike,
  onToggleComments,
  onSubmitComment,
  onCommentInputChange,
  onDeletePost,
  onDeleteComment,
  selectedDepartment,
  onDepartmentChange,
  searchQuery,
  onNavigateToPost,
  onNavigateToUser,
}: Props) {
  const visiblePosts = searchQuery.trim()
    ? posts.filter((p) =>
        p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts

  return (
    <>
      <div className="hidden md:block">
        <ComposeBox
          myProfile={myProfile}
          displayName={displayName}
          isComposing={isComposing}
          body={createBody}
          imageFile={createImageFile}
          imagePreview={createImagePreview}
          isLoading={createLoading}
          error={createError}
          onBodyChange={onBodyChange}
          onImageFileChange={onImageFileChange}
          onOpen={onComposeOpen}
          onReset={onComposeReset}
          onSubmit={onCreatePost}
        />
      </div>

      <DepartmentFilter selected={selectedDepartment} onChange={onDepartmentChange} />

      {postsLoading && (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 rounded-full border-[3px] border-uj-blue border-t-transparent animate-spin" />
        </div>
      )}

      {!postsLoading && postsError && (
        <div className="bg-red-50 text-red-600 text-sm rounded-2xl px-4 py-3 border border-red-100">
          Błąd: {postsError}
        </div>
      )}

      {!postsLoading && !postsError && visiblePosts.length === 0 && (
        searchQuery.trim() ? (
          <EmptyState
            icon={Search}
            title={`Brak wyników dla „${searchQuery}"`}
            subtitle="Spróbuj innej frazy lub wyczyść pole wyszukiwania."
          />
        ) : selectedDepartment ? (
          <EmptyState
            icon={Filter}
            title="Brak wpisów z tego wydziału"
            subtitle="Wybierz inny wydział lub dodaj pierwszy wpis z tej społeczności."
          />
        ) : (
          <EmptyState
            icon={MessageCircle}
            title="Brak wpisów"
            subtitle="Bądź pierwszy! Podziel się czymś ze społecznością UJ."
          />
        )
      )}

      <AnimatePresence mode="popLayout">
        {!postsLoading && !postsError && visiblePosts.map((post, idx) => {
          const postId = String(post?.id ?? `fallback-${idx}`)
          return (
            <motion.div
              key={postId}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.4) }}
              layout
            >
              <PostCard
                post={post}
                index={idx}
                currentUserId={currentUserId}
                myProfile={myProfile}
                displayName={displayName}
                likeCount={likesCountByPost[postId] ?? 0}
                isLiked={Boolean(likedPostIds[postId])}
                isPop={heartPopPostId === postId}
                commentCount={commentsCountByPost[postId] ?? 0}
                isCommentsOpen={expandedComments.has(postId)}
                comments={commentsByPost[postId] ?? []}
                commentInputValue={commentInput[postId] ?? ''}
                isCommentSubmitting={Boolean(commentSubmitting[postId])}
                onToggleLike={() => onToggleLike(postId)}
                onToggleComments={() => onToggleComments(postId)}
                onSubmitComment={() => onSubmitComment(postId)}
                onCommentInputChange={(v) => onCommentInputChange(postId, v)}
                onDeletePost={() => onDeletePost(postId)}
                onDeleteComment={(cId) => onDeleteComment(cId, postId)}
                onNavigateToPost={() => onNavigateToPost(postId)}
                onNavigateToUser={onNavigateToUser}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </>
  )
}
