import * as React from 'react';
import { chatApi, ChatHistoryItem } from '../utils/api';

type Citation = {
  rank?: number;
  rerank_score?: number;
  metadata?: Record<string, unknown>;
};

type ChatMessage = {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
};

// ── Inline Markdown renderer ──────────────────────────────────────
function renderMarkdownLine(line: string, lineIndex: number): React.ReactNode {
  if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
    const cells = line.split('|').map((c) => c.trim()).filter((c) => c !== '');
    if (cells.every((c) => /^[-:]+$/.test(c))) return null;
    return (
      <div key={lineIndex} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '0.25rem 0' }}>
        {cells.map((cell, ci) => (
          <span key={ci} style={{ minWidth: '100px', fontSize: '0.83rem', color: '#334155' }}>
            {renderInlineMarkdown(cell, `${lineIndex}-${ci}`)}
          </span>
        ))}
      </div>
    );
  }
  return (
    <React.Fragment key={lineIndex}>
      {renderInlineMarkdown(line, String(lineIndex))}
    </React.Fragment>
  );
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const combined = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*]+)\*\*|(https?:\/\/[^\s)]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] && match[2]) {
      parts.push(
        <a key={`${keyPrefix}-l-${match.index}`} href={match[2]} target="_blank" rel="noopener noreferrer"
          style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'underline' }}>
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      parts.push(<strong key={`${keyPrefix}-b-${match.index}`}>{match[3]}</strong>);
    } else if (match[4]) {
      parts.push(
        <a key={`${keyPrefix}-u-${match.index}`} href={match[4]} target="_blank" rel="noopener noreferrer"
          style={{ color: '#6366f1', textDecoration: 'underline' }}>
          {match[4]}
        </a>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderTextWithLinks(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  lines.forEach((line, lineIndex) => {
    const rendered = renderMarkdownLine(line, lineIndex);
    if (rendered !== null) {
      result.push(rendered);
      if (lineIndex < lines.length - 1) result.push(<br key={`br-${lineIndex}`} />);
    }
  });
  return result;
}

// ── Citation Detail Panel ─────────────────────────────────────────
function CitationDetailPanel({
  citation,
  index,
  onClose,
}: {
  citation: Citation;
  index: number;
  onClose: () => void;
}) {
  const meta = citation.metadata ?? {};

  const titleCandidate =
    meta['Tạp chí'] ??
    meta['Tên tạp chí/hội nghị'] ??
    meta['ten_tap_chi'] ??
    meta['Tiến trình'] ??
    meta['Nội dung'] ??
    meta['Tiêu đề'];

  const title = titleCandidate ? String(titleCandidate) : `Trích dẫn ${index + 1}`;

  const hiddenFields = ['embedding', 'source_file', 'sheet_source', 'source_sheet', 'file_source'];

  const urlFields = Object.entries(meta).filter(
    ([k, v]) => !hiddenFields.includes(k) && typeof v === 'string' && (v as string).startsWith('http')
  );
  const otherFields = Object.entries(meta).filter(
    ([k, v]) =>
      !hiddenFields.includes(k) &&
      !(typeof v === 'string' && (v as string).startsWith('http'))
  );

  const labelMap: Record<string, string> = {
    'STT': 'Số thứ tự',
    'ISSN': 'ISSN',
    'e-ISSN': 'e-ISSN',
    'SJR': 'Xếp hạng SJR',
    'JCR': 'JCR Impact Factor',
    'H-index': 'Chỉ số H-index',
    'Ngành/Liên ngành': 'Ngành / Liên ngành',
    'Tạp chí': 'Tên tạp chí',
    'Tên tạp chí/hội nghị': 'Tên tạp chí/hội nghị',
    'Link tạp chí/hội nghị': 'Website',
    'Nguồn dữ liệu (Trang chính thức)': 'Trang chính thức',
  };

  return (
    <div
      style={{
        marginTop: '0.5rem',
        borderRadius: '12px',
        border: '1.5px solid #818cf8',
        background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
        overflow: 'hidden',
        animation: 'slideDown 0.18s ease',
        boxShadow: '0 4px 20px rgba(99,102,241,0.12)',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.6rem 0.9rem',
          background: 'linear-gradient(90deg, #6366f1, #818cf8)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            {index + 1}
          </span>
          <span style={{ fontSize: '0.83rem', fontWeight: 700 }}>📄 {title}</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            borderRadius: '6px',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.9rem',
            fontWeight: 700,
          }}
        >
          ×
        </button>
      </div>

      {/* Panel body */}
      <div style={{ padding: '0.75rem 0.9rem' }}>
        {/* Metadata grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '0.3rem 0.75rem',
            fontSize: '0.8rem',
          }}
        >
          {otherFields.map(([key, value]) => (
            <React.Fragment key={key}>
              <span
                style={{
                  color: '#6366f1',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  paddingTop: '0.05rem',
                }}
              >
                {labelMap[key] ?? key}:
              </span>
              <span style={{ color: '#1e293b', lineHeight: 1.5 }}>{String(value)}</span>
            </React.Fragment>
          ))}
        </div>

        {/* URL fields */}
        {urlFields.length > 0 && (
          <div style={{ marginTop: '0.6rem', paddingTop: '0.6rem', borderTop: '1px solid #ddd6fe' }}>
            {urlFields.map(([key, value]) => (
              <div key={key} style={{ marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 600, marginRight: '0.4rem' }}>
                  🔗 {labelMap[key] ?? key}:
                </span>
                <a
                  href={String(value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: '0.78rem',
                    color: '#4f46e5',
                    textDecoration: 'underline',
                    wordBreak: 'break-all',
                    fontWeight: 500,
                  }}
                >
                  {String(value)}
                </a>
              </div>
            ))}
          </div>
        )}

        {/* Rerank score badge */}
        {citation.rerank_score !== undefined && (
          <div style={{ marginTop: '0.5rem' }}>
            <span
              style={{
                display: 'inline-block',
                padding: '0.15rem 0.5rem',
                borderRadius: '20px',
                background: '#ede9fe',
                color: '#7c3aed',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              Điểm liên quan: {(citation.rerank_score * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Citation Badges + Expandable Panel ───────────────────────────
function CitationRow({ citations }: { citations: Citation[] }) {
  const [activeCitation, setActiveCitation] = React.useState<number | null>(null);

  if (!citations.length) return null;

  const toggle = (i: number) => setActiveCitation((prev) => (prev === i ? null : i));

  return (
    <div style={{ marginTop: '0.5rem' }}>
      {/* Badge row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginRight: '2px' }}>
          Nguồn:
        </span>
        {citations.map((_c, i) => {
          const isActive = activeCitation === i;
          return (
            <button
              key={i}
              title={`Xem nguồn [${i + 1}] — click để mở`}
              onClick={() => toggle(i)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: isActive ? '#6366f1' : '#e0e7ff',
                color: isActive ? '#ffffff' : '#6366f1',
                border: `2px solid ${isActive ? '#4f46e5' : '#818cf8'}`,
                fontSize: '0.66rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s, transform 0.1s',
                transform: isActive ? 'scale(1.15)' : 'scale(1)',
                lineHeight: 1,
              }}
            >
              {i + 1}
            </button>
          );
        })}
        {activeCitation !== null && (
          <span style={{ fontSize: '0.7rem', color: '#6366f1', marginLeft: '4px', fontStyle: 'italic' }}>
            ← bấm lại để đóng
          </span>
        )}
      </div>

      {/* Detail panel (expands below badges) */}
      {activeCitation !== null && (
        <CitationDetailPanel
          citation={citations[activeCitation]}
          index={activeCitation}
          onClose={() => setActiveCitation(null)}
        />
      )}
    </div>
  );
}

// ── Main ChatWidget ───────────────────────────────────────────────
export default function ChatWidget({ isOpen }: { isOpen: boolean }) {
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  // chatHistory: lịch sử hội thoại gửi lên backend — riêng biệt với messages UI
  const [chatHistory, setChatHistory] = React.useState<ChatHistoryItem[]>([]);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 1,
      role: 'assistant',
      text: 'Tôi có thể hỗ trợ tra cứu tạp chí, tính điểm GS/PGS và giải thích quy định.',
      citations: [],
    },
  ]);
  const messageViewportRef = React.useRef<HTMLDivElement | null>(null);

  // Reset session — xóa cả lịch sử và tin nhắn UI
  const clearSession = () => {
    setChatHistory([]);
    setMessages([{
      id: Date.now(),
      role: 'assistant',
      text: 'Phiên mới bắt đầu. Tôi có thể hỗ trợ tra cứu tạp chí, tính điểm GS/PGS và giải thích quy định.',
      citations: [],
    }]);
  };

  React.useEffect(() => {
    const viewport = messageViewportRef.current;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, isOpen]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    const nextUserMessage: ChatMessage = { id: Date.now(), role: 'user', text: trimmed };
    setMessages((c) => [...c, nextUserMessage]);
    setInput('');
    setSending(true);

    // Snapshot history BEFORE adding current turn (backend expects prior turns)
    const historySnapshot = chatHistory;

    try {
      const response = await chatApi.send(trimmed, historySnapshot);
      const answerText = String(response.answer ?? 'Không có phản hồi.');

      setMessages((c) => [
        ...c,
        {
          id: Date.now() + 1,
          role: 'assistant',
          text: answerText,
          citations: Array.isArray(response.citations) ? response.citations : [],
        },
      ]);

      // Accumulate history: add current user turn + assistant reply
      setChatHistory((h) => [
        ...h,
        { role: 'user',      content: trimmed },
        { role: 'assistant', content: answerText },
      ]);
    } catch (error) {
      let message = 'Không thể kết nối chatbot.';
      if (error instanceof Error) {
        message = error.message.includes('API không tồn tại')
          ? 'Chat API chưa sẵn sàng trên backend :10000. Hãy restart backend.'
          : error.message;
      }
      setMessages((c) => [
        ...c,
        { id: Date.now() + 1, role: 'assistant', text: message, citations: [] },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          position: 'absolute',
          bottom: isExpanded ? 'calc(100vh - min(88vh, 820px) - 70px)' : '70px',
          right: 0,
          width: isExpanded ? 'min(88vw, 860px)' : '440px',
          height: isExpanded ? 'min(88vh, 820px)' : '600px',
          maxWidth: 'calc(100vw - 1.5rem)',
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 60px rgba(15,23,42,0.15)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateRows: 'auto 1fr auto',
          transition: 'width 0.25s ease, height 0.25s ease, bottom 0.25s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '0.85rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #eef2ff, #f8fafc)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem',
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>AI Chatbot</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
              Tra cứu tạp chí, điểm GS/PGS và quy định
              {chatHistory.length > 0 && (
                <span style={{ marginLeft: '0.5rem', color: '#818cf8' }}>
                  · {Math.floor(chatHistory.length / 2)} lượt hội thoại
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            {/* Clear session button */}
            {chatHistory.length > 0 && (
              <button
                onClick={clearSession}
                title="Bắt đầu phiên mới (xóa lịch sử hội thoại)"
                style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  border: '1px solid #fca5a5', background: '#fff1f2',
                  color: '#ef4444', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: '0.85rem',
                }}
              >
                <i className="fas fa-rotate-left" />
              </button>
            )}
            <button
              onClick={() => setIsExpanded((c) => !c)}
              title={isExpanded ? 'Thu nhỏ' : 'Phóng to'}
              style={{
                width: '36px', height: '36px', borderRadius: '10px',
                border: '1px solid #cbd5e1', background: '#ffffff',
                color: '#475569', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <i className={`fas ${isExpanded ? 'fa-compress' : 'fa-expand'}`} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messageViewportRef}
          style={{ padding: '1rem', overflowY: 'auto', background: '#ffffff' }}
        >
          {messages.map((message) => (
            <div
              key={message.id}
              style={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '0.9rem',
              }}
            >
              <div style={{ maxWidth: '90%' }}>
                {/* Message bubble */}
                <div
                  style={{
                    padding: '0.7rem 0.9rem',
                    borderRadius: '14px',
                    background: message.role === 'user' ? '#6366f1' : '#f8fafc',
                    color: message.role === 'user' ? '#ffffff' : '#1e293b',
                    border: message.role === 'user' ? 'none' : '1px solid #e2e8f0',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word',
                  }}
                >
                  {renderTextWithLinks(message.text)}
                </div>

                {/* Citation badges + expandable panel */}
                {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                  <CitationRow citations={message.citations} />
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{
                padding: '0.7rem 0.9rem', borderRadius: '14px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                fontSize: '0.82rem', color: '#64748b',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span>●</span><span>AI đang trả lời...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.8rem', background: '#ffffff' }}>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder="Hỏi về tạp chí, điểm quy đổi, điều kiện GS/PGS..."
              rows={2}
              style={{
                flex: 1, resize: 'none', borderRadius: '12px',
                border: '1px solid #cbd5e1', padding: '0.75rem 0.85rem',
                fontSize: '0.84rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={sending || !input.trim()}
              style={{
                minWidth: '52px', border: 'none', borderRadius: '12px',
                background: sending || !input.trim() ? '#cbd5e1' : '#6366f1',
                color: 'white',
                cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
              }}
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
