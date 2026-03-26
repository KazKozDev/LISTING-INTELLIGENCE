import { useEffect, useMemo } from 'react'

export function useObjectUrlPreview(file: File | null): string | null {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    if (!preview) {
      return
    }

    return () => {
      URL.revokeObjectURL(preview)
    }
  }, [preview])

  return preview
}

export function useObjectUrlPreviews(files: File[]): string[] {
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files])

  useEffect(() => {
    if (previews.length === 0) {
      return
    }

    return () => {
      previews.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  }, [previews])

  return previews
}