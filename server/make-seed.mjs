import fs from 'node:fs/promises';
import { comments, posts } from '../src/content.js';
import { galleryItems } from '../src/gallery.js';
await fs.writeFile(new URL('./seed.json', import.meta.url), JSON.stringify({ comments, posts, gallery: galleryItems.map(item => ({ ...item, description: '' })) }, null, 2));
