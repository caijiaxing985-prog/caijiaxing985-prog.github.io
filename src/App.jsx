import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  FileText,
  MessageCircle,
  Search,
} from "lucide-react";
import { comments, posts } from "./content.js";
import { buildPostText, copyText } from "./copy.js";

const tabs = [
  { id: "comments", label: "发评论", count: comments.length, icon: MessageCircle },
  { id: "posts", label: "发图文", count: posts.length, icon: FileText },
];

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

export default function App() {
  const [activeTab, setActiveTab] = useState("comments");
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState("全部方向");
  const [copiedId, setCopiedId] = useState("");
  const [toast, setToast] = useState("");

  const directions = useMemo(
    () => ["全部方向", ...new Set(posts.map((post) => post.direction).filter(Boolean))],
    [],
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const filteredComments = useMemo(
    () => comments.filter((item) => !normalizedQuery || item.text.toLocaleLowerCase("zh-CN").includes(normalizedQuery)),
    [normalizedQuery],
  );
  const filteredPosts = useMemo(
    () => posts.filter((item) => {
      const matchesDirection = direction === "全部方向" || item.direction === direction;
      const haystack = `${item.direction} ${item.text} ${item.keywords}`.toLocaleLowerCase("zh-CN");
      return matchesDirection && (!normalizedQuery || haystack.includes(normalizedQuery));
    }),
    [direction, normalizedQuery],
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

  const visibleCount = activeTab === "comments" ? filteredComments.length : filteredPosts.length;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">J</div>
          <div>
            <h1>Jianyoon 文案库</h1>
            <p>评论与图文</p>
          </div>
        </div>
        <div className="total-count">共 {comments.length + posts.length} 条</div>
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
                placeholder="搜索文案"
                aria-label="搜索文案"
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
            <span className="result-count">{visibleCount} 条</span>
          </div>
        </div>

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
        ) : (
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
        )}

        {visibleCount === 0 && <div className="empty-state">没有匹配的文案</div>}
      </main>

      <div className={`toast${toast ? " visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
