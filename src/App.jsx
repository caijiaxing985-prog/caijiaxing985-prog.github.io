import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Images,
  MessageCircle,
  Search,
} from "lucide-react";
import { buildPostText, copyText } from "./copy.js";

function CopyButton({ id, copiedId, label = "复制", onCopy, secondary = false }) {
  const copied = copiedId === id;
  const Icon = copied ? Check : Copy;
  return (
    <button
      className={`copy-button${secondary ? " secondary" : ""}${copied ? " copied" : ""}`}
      type="button"
      onClick={onCopy}
      aria-label={copied ? "已复制" : label}
    >
      <Icon size={16} strokeWidth={2} aria-hidden="true" />
      <span>{copied ? "已复制" : label}</span>
    </button>
  );
}

export default function App({ library }) {
  const { comments, posts, gallery: galleryItems } = library;
  const tabs = [
    { id: 'comments', label: '发评论', count: comments.length, icon: MessageCircle },
    { id: 'posts', label: '发图文', count: posts.length, icon: FileText },
    { id: 'gallery', label: '宣传图库', count: galleryItems.length, icon: Images },
  ];
  const [activeTab, setActiveTab] = useState("comments");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("全部方向");
  const [copiedId, setCopiedId] = useState("");
  const [toast, setToast] = useState("");

  const directions = useMemo(
    () => ["全部方向", ...new Set(posts.map((post) => post.direction).filter(Boolean))],
    [posts],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const filteredComments = useMemo(
    () => comments.filter((item) => !normalizedQuery || item.text.toLocaleLowerCase("zh-CN").includes(normalizedQuery)),
    [normalizedQuery, comments],
  );
  const filteredPosts = useMemo(
    () => posts.filter((item) => {
      const matchesDirection = direction === "全部方向" || item.direction === direction;
      const haystack = `${item.direction} ${item.text} ${item.keywords}`.toLocaleLowerCase("zh-CN");
      return matchesDirection && (!normalizedQuery || haystack.includes(normalizedQuery));
    }),
    [direction, normalizedQuery, posts],
  );
  const filteredGallery = useMemo(
    () => galleryItems.filter((item) => {
      const haystack = `${item.title} ${item.description || ''} ${item.commentIds.join(" ")}`.toLocaleLowerCase("zh-CN");
      return !normalizedQuery || haystack.includes(normalizedQuery);
    }),
    [normalizedQuery, galleryItems],
  );

  const performCopy = async (id, text, message) => {
    try {
      await copyText(text);
      setCopiedId(id);
      setToast(message);
      window.setTimeout(() => setCopiedId(""), 1600);
      window.setTimeout(() => setToast(""), 1800);
    } catch {
      setToast("复制失败，请长按文字复制");
      window.setTimeout(() => setToast(""), 2200);
    }
  };

  const visibleCount = activeTab === "comments"
    ? filteredComments.length
    : activeTab === "posts"
      ? filteredPosts.length
      : filteredGallery.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">J</div>
          <div>
            <h1>Jianyoon 文案库</h1>
            <p>评论、图文与宣传素材</p>
          </div>
        </div>
        <div className="total-count">共 {comments.length + posts.length + galleryItems.length} 项</div>
      </header>

      <main className="workspace">
        <div className="controls">
          <div className="tab-list" role="tablist" aria-label="文案类型">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={`tab-button${active ? " active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                  <span>{tab.label}</span>
                  <strong>{tab.count}</strong>
                </button>
              );
            })}
          </div>

          <div className="filter-row">
            <label className="search-box">
              <Search size={17} strokeWidth={2} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeTab === "gallery" ? "搜索图片名称或评论序号" : "搜索文案"}
                aria-label="搜索内容"
              />
            </label>
            {activeTab === "posts" && (
              <select
                className="direction-select"
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                aria-label="内容方向"
              >
                {directions.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}
            <span className="result-count">{visibleCount} {activeTab === "gallery" ? "张" : "条"}</span>
          </div>
        </div>

        {activeTab === "comments" && (
          <aside className="comment-guide" aria-label="评论小教程">
            <strong>评论小教程：手动 @，名字才会变蓝</strong>
            <ol>
              <li>复制文案，粘贴到抖音评论框。</li>
              <li>删掉文案中的 <code>{"<@>jianyoon"}</code>，在原位置先输入 <code>{"<"}</code>，再手动输入 <code>@</code>。</li>
              <li>搜索并选中用户 <code>{">jianyoon"}</code>（下图账号）。名字变蓝后，保留后面的文案再发布。</li>
            </ol>
            <p>前面的 <code>{"<"}</code> 要保留；只粘贴名字不会生成蓝色 @。</p>
              <div className="guide-images">
                <figure><figcaption>选择这个账号：{">jianyoon"}</figcaption><a href="/tutorial/account.png" target="_blank" rel="noreferrer"><img src="/tutorial/account.png" alt="要选择的用户 >jianyoon，锋云 API 头像" loading="lazy" /></a></figure>
                <figure><figcaption>效果参考：选中后名字变蓝</figcaption><a href="/tutorial/result.jpg" target="_blank" rel="noreferrer"><img src="/tutorial/result.jpg" alt="抖音评论中的蓝色用户名效果" loading="lazy" /></a></figure>
              </div>
          </aside>
        )}

        {activeTab === "posts" && (
          <aside className="comment-guide post-guide" aria-label="图文发布小教程">
            <strong>图文发布小教程</strong>
            <ol>
              <li>选一条文案，点“复制文案”，到抖音“写文字”里粘贴，生成图文封面。</li>
              <li>在发布简介中写上福利介绍，再加相关 <code>#话题</code>。本页“复制全部”可一起复制文案和关键词。</li>
              <li>需要配图时，到“宣传图库”保存图片，也可以添加本站的真实使用截图，作为后续图片。</li>
              <li>预览封面、简介和图片，确认后发布；需要在评论里补图时，点评论框旁的图片按钮添加。</li>
            </ol>
            <div className="post-guide-images">
              <figure><figcaption>1. 粘贴文案，制作图文</figcaption><a href="/tutorial/post-write.png" target="_blank" rel="noreferrer"><img src="/tutorial/post-write.png" alt="抖音写文字页面，长按粘贴文案" loading="lazy" /></a></figure>
              <figure><figcaption>2. 填写简介和 #话题</figcaption><a href="/tutorial/post-caption.png" target="_blank" rel="noreferrer"><img src="/tutorial/post-caption.png" alt="发布页区分图文封面和简介，简介添加福利及话题" loading="lazy" /></a></figure>
              <figure><figcaption>3. 可补充真实使用截图</figcaption><a href="/tutorial/post-proof.png" target="_blank" rel="noreferrer"><img src="/tutorial/post-proof.png" alt="图文作品附上本站实际调用记录截图" loading="lazy" /></a></figure>
              <figure><figcaption>4. 发布效果与评论补图</figcaption><a href="/tutorial/post-result.png" target="_blank" rel="noreferrer"><img src="/tutorial/post-result.png" alt="发布后的图文作品，评论框图片按钮可以添加配图" loading="lazy" /></a></figure>
            </div>
          </aside>
        )}

        {activeTab === "comments" ? (
          <section className="content-list" aria-label="评论文案">
            {filteredComments.map((item) => (
              <article className="content-item comment-item" key={item.id}>
                <span className="item-number">#{item.id}</span>
                <p>{item.text}</p>
                <CopyButton
                  id={`comment-${item.id}`}
                  copiedId={copiedId}
                  onCopy={() => performCopy(`comment-${item.id}`, item.text, "评论已复制")}
                />
              </article>
            ))}
          </section>
        ) : activeTab === "posts" ? (
          <section className="content-list" aria-label="图文文案">
            {filteredPosts.map((item) => (
              <article className="content-item post-item" key={item.id}>
                <div className="post-copy">
                  <div className="post-meta">
                    <span className="item-number">#{item.id}</span>
                    <span className="direction-tag">{item.direction}</span>
                  </div>
                  <p>{item.text}</p>
                  <div className="keywords">{item.keywords}</div>
                </div>
                <div className="post-actions">
                  <CopyButton
                    id={`post-${item.id}`}
                    copiedId={copiedId}
                    label="复制文案"
                    secondary
                    onCopy={() => performCopy(`post-${item.id}`, buildPostText(item), "文案已复制")}
                  />
                  <CopyButton
                    id={`post-all-${item.id}`}
                    copiedId={copiedId}
                    label="复制全部"
                    onCopy={() => performCopy(`post-all-${item.id}`, buildPostText(item, true), "文案和关键词已复制")}
                  />
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="gallery-grid" aria-label="宣传图库">
            {filteredGallery.map((item) => (
              <article className="gallery-item" key={item.id}>
                <a className="gallery-preview" href={item.file} target="_blank" rel="noreferrer">
                  <img src={item.file} alt={item.title} loading="lazy" />
                </a>
                <div className="gallery-info">
                  <div className="gallery-heading">
                    <span className="item-number">#{item.id}</span>
                    <h2>{item.title}</h2>
                  </div>
                  {item.description && <p className="gallery-description">{item.description}</p>}
                  <div className="comment-references">
                    {item.commentIds.map((id) => <span key={id}>评论 #{id}</span>)}
                  </div>
                  <div className="gallery-actions">
                    <a className="asset-button primary" href={item.file} download={`jianyoon-${item.id}.${item.file.split('.').pop()}`}>
                      <Download size={16} strokeWidth={2} aria-hidden="true" />
                      <span>下载图片</span>
                    </a>
                    <a className="asset-button" href={item.file} target="_blank" rel="noreferrer">
                      <ExternalLink size={16} strokeWidth={2} aria-hidden="true" />
                      <span>查看原图</span>
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}

        {visibleCount === 0 && <div className="empty-state">没有匹配的文案</div>}
      </main>

      <div className={`toast${toast ? " visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
