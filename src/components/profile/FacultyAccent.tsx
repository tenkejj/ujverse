import type { ReactNode } from 'react'

type Props = {
  department?: string | null
  className?: string
  children: ReactNode
}

/**
 * Tymczasowo wyłączone: nie wstrzykuje już `--profile-*` per wydział.
 * Wrapper zachowany dla kompatybilności importów; kolory UI = tokeny brand (navy / złoto).
 */
export default function FacultyAccent({ department: _department, className, children }: Props) {
  void _department
  if (className) {
    return <div className={className}>{children}</div>
  }
  return <>{children}</>
}
