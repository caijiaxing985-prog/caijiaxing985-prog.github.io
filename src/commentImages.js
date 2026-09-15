export function imagesForComment(gallery, commentId) {
  return gallery.filter(item => item.commentIds.includes(commentId));
}

export function setCommentImageLinked(gallery, imageId, commentId, linked) {
  return gallery.map(item => {
    if (item.id !== imageId) return item;
    const commentIds = linked
      ? [...new Set([...item.commentIds, commentId])]
      : item.commentIds.filter(id => id !== commentId);
    return { ...item, commentIds };
  });
}

export function appendCommentImages(gallery, uploads, commentId) {
  let nextId = Math.max(0, ...gallery.map(item => item.id)) + 1;
  return [...gallery, ...uploads.map(upload => ({
    id: nextId++,
    title: upload.name.replace(/\.[^.]+$/, '') || `评论配图 ${nextId - 1}`,
    description: '',
    file: upload.file,
    commentIds: [commentId],
  }))];
}

export function unlinkImagesFromComment(gallery, commentId) {
  return gallery.map(item => ({ ...item, commentIds: item.commentIds.filter(id => id !== commentId) }));
}
