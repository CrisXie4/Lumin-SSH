import { useEffect, useState } from 'react';

export interface GitChangeReview {
  reviewId: string;
  sessionId?: string;
  path?: string;
  toolName?: string;
  blocks?: unknown[];
  [key: string]: unknown;
}

function normalizeReview(value: unknown): GitChangeReview | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const source = value as Record<string, unknown>;
  const reviewId = typeof source.reviewId === 'string' ? source.reviewId.trim() : '';
  if (!reviewId) {
    return null;
  }
  return {
    ...source,
    reviewId,
  } as GitChangeReview;
}

export default function useGitReview() {
  const [gitReview, setGitReview] = useState<GitChangeReview | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ review?: unknown }>).detail || {};
      const review = normalizeReview(detail.review);
      if (review) {
        setGitReview(review);
      }
    };
    const handleClose = (event: Event) => {
      const detail = (event as CustomEvent<{ reviewId?: unknown }>).detail || {};
      const reviewId = typeof detail.reviewId === 'string' ? detail.reviewId.trim() : '';
      setGitReview((current) => {
        if (!current || !reviewId || current.reviewId === reviewId) {
          return null;
        }
        return current;
      });
    };
    window.addEventListener('git-change-review-required', handleOpen);
    window.addEventListener('git-change-review-clear', handleClose);
    return () => {
      window.removeEventListener('git-change-review-required', handleOpen);
      window.removeEventListener('git-change-review-clear', handleClose);
    };
  }, []);

  return { gitReview };
}