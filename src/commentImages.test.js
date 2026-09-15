import { describe, expect, it } from 'vitest';
import { appendCommentImages, imagesForComment, setCommentImageLinked, unlinkImagesFromComment } from './commentImages.js';

const gallery = [
  { id: 4, title: '第一张', file: '/gallery/a.png', description: '', commentIds: [2] },
  { id: 9, title: '第二张', file: '/gallery/b.png', description: '', commentIds: [1, 2] },
];

describe('comment image associations', () => {
  it('returns linked images in gallery order', () => {
    expect(imagesForComment(gallery, 2).map(item => item.id)).toEqual([4, 9]);
    expect(imagesForComment(gallery, 3)).toEqual([]);
  });

  it('links and unlinks without mutating the existing gallery', () => {
    const linked = setCommentImageLinked(gallery, 4, 3, true);
    expect(linked[0].commentIds).toEqual([2, 3]);
    expect(gallery[0].commentIds).toEqual([2]);
    expect(setCommentImageLinked(linked, 4, 3, true)[0].commentIds).toEqual([2, 3]);
    expect(setCommentImageLinked(linked, 4, 2, false)[0].commentIds).toEqual([3]);
  });

  it('creates sequential gallery items linked to the comment', () => {
    const result = appendCommentImages(gallery, [
      { file: '/uploads/c.png', name: '截图一.png' },
      { file: '/uploads/d.jpg', name: '截图二.jpg' },
    ], 7);
    expect(result.slice(-2)).toEqual([
      { id: 10, title: '截图一', description: '', file: '/uploads/c.png', commentIds: [7] },
      { id: 11, title: '截图二', description: '', file: '/uploads/d.jpg', commentIds: [7] },
    ]);
  });

  it('removes stale image links when a comment is deleted', () => {
    expect(unlinkImagesFromComment(gallery, 2).map(item => item.commentIds)).toEqual([[], [1]]);
    expect(gallery.map(item => item.commentIds)).toEqual([[2], [1, 2]]);
  });
});
