import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { useTheme } from '../contexts/ThemeContext';
import { cssVars, images, assistant } from '../design/design';
import {
  ArrowUp,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeft,
  Scale,
  Briefcase,
  HeartHandshake,
  ShieldAlert,
  Copy,
  Check,
  ArrowRight,
  X,
  Star,
  MapPin,
  LogIn,
} from 'lucide-react';
import '../styles/chat.css';

const WELCOME = `Assalam-o-Alaikum! I'm ${assistant.name}, LegalLink's AI legal assistant. I understand English and Roman Urdu.\n\nTell me what happened, and I'll explain your rights under Pakistani law and the next steps to take.`;

/** Starter questions shown on an empty chat */
const STARTERS = [
  { icon: Scale, title: 'Property dispute', text: 'Meri zameen par kisi ne qabza kar liya hai, kya karun?' },
  { icon: HeartHandshake, title: 'Family law', text: 'How do I file for khula and what is the process?' },
  { icon: ShieldAlert, title: 'Cyber crime', text: 'Someone is blackmailing me online with my photos.' },
  { icon: Briefcase, title: 'Employment', text: 'My employer has not paid my salary for 3 months.' },
];

// Older versions kept visitors' chats in this browser. Chats are now saved on
// the server for signed-in users only, so clear the old local copies once.
const clearOldLocalChats = () => {
  try {
    Object.keys(localStorage)
      .filter((k) => k === 'chatSessions' || k.startsWith('chat_'))
      .forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    /* storage unavailable */
  }
};

// While an answer is still arriving, hide a "**" whose closing pair hasn't come yet
const tidyPartial = (text) => {
  const marks = (text.match(/\*\*/g) || []).length;
  return marks % 2 ? text.replace(/\*\*(?![\s\S]*\*\*)/, '') : text;
};

// The open conversation is kept for this browser tab only (sessionStorage), so
// visiting an advocate or NGO and coming back does not lose it. Visitors' chats
// disappear when the tab is closed; signed-in users' chats are saved on the server.
const TAB_KEY = 'mizan_open_chat';
const readTabChat = () => {
  try {
    return JSON.parse(sessionStorage.getItem(TAB_KEY) || 'null');
  } catch (e) {
    return null;
  }
};
const writeTabChat = (value) => {
  try {
    if (value) sessionStorage.setItem(TAB_KEY, JSON.stringify(value));
    else sessionStorage.removeItem(TAB_KEY);
  } catch (e) {
    /* storage full or unavailable */
  }
};

const fromSaved = (m) => ({
  role: m.role,
  content: m.content,
  timestamp: new Date(m.createdAt || m.timestamp || Date.now()),
  kind: m.meta?.kind ?? m.kind,
  legalCategory: m.meta?.category ?? m.legalCategory,
  urgency: m.meta ? (m.meta.urgent ? 'urgent' : null) : m.urgency,
  aid: m.meta?.aid ?? m.aid,
  lawyers: m.meta?.lawyers || m.lawyers || [],
  ngos: m.meta?.ngos || m.ngos || [],
  city: m.meta?.city || m.city || null,
  isError: m.isError,
});

const welcomeMessage = () => ({ role: 'model', content: WELCOME, timestamp: new Date(), isWelcome: true });

const initials = (name = '') =>
  name.replace(/^adv\.?\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'A';

/** Advocate and NGO suggestions under an answer */
const Suggestions = ({ m, onNavigate }) => {
  const lawyers = m.lawyers || [];
  const ngos = m.ngos || [];
  const showBrowse = m.kind === 'legal';
  if (!lawyers.length && !ngos.length && !showBrowse) return null;
  const cat = m.legalCategory && m.legalCategory !== 'General' ? m.legalCategory : null;
  return (
    <div className="chat-suggest">
      {lawyers.length > 0 && (
        <>
          <div className="chat-suggest-label">
            {cat ? `${cat} advocates` : 'Verified advocates'}{m.city ? ` · ${m.city}` : ''}
          </div>
          <div className="chat-cards">
            {lawyers.map((l) => (
              <button key={l._id} type="button" className="chat-card" onClick={() => onNavigate(`/lawyer/${l._id}`)}>
                {l.photo ? <img className="chat-card-avatar" src={l.photo} alt="" /> : <span className="chat-card-avatar">{initials(l.name)}</span>}
                <span className="chat-card-body">
                  <strong>{l.name}</strong>
                  <small>{(l.specialization || []).join(' · ') || 'Advocate'}</small>
                  <small className="chat-card-meta">
                    {l.rating > 0 && <><Star size={11} /> {Number(l.rating).toFixed(1)} · </>}
                    {l.experience} yrs{l.location ? ` · ${l.location}` : ''}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {ngos.length > 0 && (
        <>
          <div className="chat-suggest-label">Free legal aid</div>
          <div className="chat-cards">
            {ngos.map((n) => (
              <button key={n._id} type="button" className="chat-card is-ngo" onClick={() => onNavigate(`/ngo/${n._id}`)}>
                <span className="chat-card-avatar"><HeartHandshake size={16} /></span>
                <span className="chat-card-body">
                  <strong>{n.name}</strong>
                  <small>{(n.focusAreas || []).join(' · ') || 'Legal aid'}</small>
                  {n.city && <small className="chat-card-meta"><MapPin size={11} /> {n.city}</small>}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {showBrowse && (
        <div className="chat-suggest-actions">
          <button
            type="button"
            className="chat-action"
            onClick={() => onNavigate(cat ? `/lawyers?specialization=${encodeURIComponent(cat)}` : '/lawyers')}
          >
            <Briefcase size={15} /> {cat ? `See all ${cat} advocates` : 'Find an advocate'} <ArrowRight size={14} />
          </button>
          {m.aid && ngos.length === 0 && (
            <button type="button" className="chat-action is-quiet" onClick={() => onNavigate('/ngos')}>
              <HeartHandshake size={15} /> Free legal aid NGOs
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const timeLabel = (d) => {
  try {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
};

/** Light formatting: **bold**, bullet and numbered lines, paragraphs */
const Formatted = ({ content }) => {
  if (!content) return null;
  return content.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="chat-gap" />;
    const trimmed = line.trim();
    const isBullet = /^[•\-*]\s/.test(trimmed);
    const isNumber = /^\d+\.\s/.test(trimmed);
    const text = isBullet ? trimmed.replace(/^[•\-*]\s/, '') : trimmed;
    const parts = text.split(/(\*\*.*?\*\*)/g).map((part, j) =>
      part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : part
    );
    if (isBullet) return <div key={i} className="chat-li"><span className="chat-li-dot" />{parts}</div>;
    if (isNumber) return <div key={i} className="chat-li is-num">{parts}</div>;
    return <p key={i} className="chat-p">{parts}</p>;
  });
};

const ChatbotPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, loading: authLoading } = useAuth();
  // Server id of the open conversation (signed-in users) or a temporary id (visitors)
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatSessions, setChatSessions] = useState([]);
  const [streamingIdx, setStreamingIdx] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  /* ── Clear chats kept in the browser by older versions ── */
  useEffect(() => {
    clearOldLocalChats();
  }, []);

  /* ── Signed-in users: load their saved conversations ── */
  const loadSessions = useCallback(async () => {
    if (!isAuthenticated) {
      setChatSessions([]);
      return;
    }
    try {
      const { data } = await api.get('/chat/sessions');
      setChatSessions(data.sessions || []);
    } catch (e) {
      setChatSessions([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /* ── Open a saved conversation from the server ── */
  const openSaved = useCallback(async (id) => {
    const { data } = await api.get(`/chat/sessions/${id}`);
    setCurrentSessionId(id);
    setMessages((data.messages || []).map(fromSaved));
  }, []);

  /* ── Coming back to this page: reopen the chat that was open in this tab ── */
  const restored = useRef(false);
  useEffect(() => {
    if (authLoading || restored.current) return;
    restored.current = true;
    const tab = readTabChat();
    if (tab?.saved && isAuthenticated && tab.sessionId) {
      openSaved(tab.sessionId).catch(() => setMessages([welcomeMessage()]));
    } else if (tab && !tab.saved && !isAuthenticated && tab.messages?.length) {
      setCurrentSessionId(tab.sessionId || null);
      setMessages(tab.messages.map(fromSaved));
    } else {
      setMessages([welcomeMessage()]);
    }
  }, [authLoading, isAuthenticated, openSaved]);

  /* ── Remember the open chat for this tab (after each finished answer) ── */
  useEffect(() => {
    if (!restored.current || streamingIdx !== null) return;
    if (!messages.some((m) => m.role === 'user')) return;
    const saved = isAuthenticated && currentSessionId && !String(currentSessionId).startsWith('guest-');
    writeTabChat(
      saved
        ? { saved: true, sessionId: currentSessionId }
        : { saved: false, sessionId: currentSessionId, messages: messages.filter((m) => m.content).slice(-40) }
    );
  }, [messages, streamingIdx, currentSessionId, isAuthenticated]);

  /* ── Keep the conversation pinned to the latest message.
        Only the message list scrolls — the page itself never moves. ── */
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasConversation = messages.some((m) => m.role === 'user');
    el.scrollTo({ top: hasConversation ? el.scrollHeight : 0, behavior: messages.length > 2 ? 'smooth' : 'auto' });
  }, [messages, isLoading]);

  /* ── Grow the text box with its content (up to a limit) ── */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // Older endpoint, used only if streaming is not available
  const sendClassic = async (message, aiIndex) => {
    const { data } = await api.post('/chat/message', { message, sessionId: currentSessionId || 'guest' });
    setMessages((prev) => {
      const next = [...prev];
      next[aiIndex] = {
        ...next[aiIndex],
        content: data.reply || data.response || 'Please try asking that again.',
        legalCategory: data.category,
        urgency: data.urgency,
        kind: 'legal',
      };
      return next;
    });
  };

  const send = async (text) => {
    const message = (text ?? input).trim();
    if (!message || isLoading) return;

    // Add the question and an empty answer that fills in as the text streams
    const base = messages.filter((m) => !m.isWelcome);
    const aiIndex = base.length + 1;
    setMessages([...base, { role: 'user', content: message, timestamp: new Date() }, { role: 'model', content: '', timestamp: new Date() }]);
    setStreamingIdx(-1);
    setInput('');
    setIsLoading(true);

    const patchAnswer = (patch) =>
      setMessages((prev) => {
        const next = [...prev];
        const cur = next[aiIndex] || { role: 'model', content: '' };
        next[aiIndex] = { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) };
        return next;
      });

    let gotText = false;
    try {
      // Visitors get a temporary id so Mizan remembers the earlier messages
      let sid = currentSessionId;
      if (!isAuthenticated && !sid) {
        sid = `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        setCurrentSessionId(sid);
      }
      const token = localStorage.getItem('token');
      const res = await fetch(`${api.defaults.baseURL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message, sessionId: sid }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        throw Object.assign(new Error('rate'), { friendly: body.message });
      }
      if (!res.ok || !res.body) throw new Error('stream unavailable');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let failed = null;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop();
        for (const evt of events) {
          const line = evt.trim();
          if (!line.startsWith('data:')) continue;
          let data;
          try {
            data = JSON.parse(line.slice(5));
          } catch (e) {
            continue;
          }
          if (data.type === 'start') {
            setStreamingIdx(aiIndex);
            if (data.sessionId) setCurrentSessionId(data.sessionId);
          } else if (data.type === 'delta') {
            gotText = true;
            setIsLoading(false);
            patchAnswer((cur) => ({ content: (cur.content || '') + data.text }));
          } else if (data.type === 'meta') {
            patchAnswer({
              kind: data.kind,
              legalCategory: data.category,
              urgency: data.urgent ? 'urgent' : null,
              aid: data.aid,
              lawyers: data.lawyers || [],
              ngos: data.ngos || [],
              city: data.city || null,
            });
          } else if (data.type === 'error') {
            failed = data;
          }
        }
      }

      if (failed && !gotText) {
        await sendClassic(message, aiIndex);
      } else if (failed) {
        patchAnswer((cur) => ({ content: `${cur.content}\n\n_The answer was cut off. Please ask again._`, isError: true }));
      }
      if (isAuthenticated) loadSessions();
    } catch (err) {
      if (!gotText) {
        try {
          if (err.friendly) throw err;
          await sendClassic(message, aiIndex);
        } catch (e2) {
          patchAnswer({
            content:
              err.friendly ||
              "I couldn't reach the assistant just now. Please try again in a moment, or browse verified advocates directly.",
            isError: true,
          });
        }
      }
    } finally {
      setIsLoading(false);
      setStreamingIdx(null);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const startNewChat = () => {
    if (isLoading) return;
    setCurrentSessionId(null);
    setMessages([welcomeMessage()]);
    writeTabChat(null);
    setSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const switchChat = async (id) => {
    if (isLoading || id === currentSessionId) return setSidebarOpen(false);
    setSidebarOpen(false);
    try {
      await openSaved(id);
    } catch (e) {
      /* conversation may have been deleted */
      loadSessions();
    }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/chat/sessions/${id}`);
    } catch (err) {
      /* ignore */
    }
    setChatSessions((prev) => prev.filter((s) => s.id !== id));
    if (id === currentSessionId) startNewChat();
  };

  const copyMessage = (text, idx) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    });
  };

  const isEmpty = !messages.some((m) => m.role === 'user');
  // Title: the saved one, or the first question that wasn't just a greeting
  const firstQuestion = messages.find(
    (m, i) => m.role === 'user' && messages[i + 1]?.kind && messages[i + 1].kind !== 'greeting'
  );
  const savedTitle = chatSessions.find((s) => s.id === currentSessionId)?.title;
  const currentTitle =
    (savedTitle && savedTitle !== 'New conversation' ? savedTitle : null) ||
    (firstQuestion ? firstQuestion.content.slice(0, 48) : 'New conversation');

  return (
    <div className="chat-page" style={cssVars(isDark)}>
      <Navbar />

      <div className="chat-app">
        {/* ───────── History sidebar ───────── */}
        <aside className={`chat-side${sidebarOpen ? ' is-open' : ''}`} aria-label="Conversations">
          <div className="chat-side-top">
            <button type="button" className="chat-new" onClick={startNewChat}>
              <Plus size={17} /> New conversation
            </button>
            <button type="button" className="chat-icon-btn chat-side-close" onClick={() => setSidebarOpen(false)} aria-label="Close history">
              <X size={18} />
            </button>
          </div>

          {isAuthenticated ? (
            <>
              <div className="chat-side-label">Saved conversations</div>
              <nav className="chat-history">
                {chatSessions.length === 0 ? (
                  <p className="chat-history-empty">Your conversations are saved here.</p>
                ) : (
                  chatSessions.map((s) => (
                    <div
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      className={`chat-history-item${s.id === currentSessionId ? ' is-active' : ''}`}
                      onClick={() => switchChat(s.id)}
                      onKeyDown={(e) => e.key === 'Enter' && switchChat(s.id)}
                    >
                      <MessageSquare size={15} />
                      <span>{s.title}</span>
                      <button type="button" className="chat-history-del" onClick={(e) => deleteChat(s.id, e)} aria-label="Delete conversation">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </nav>
            </>
          ) : (
            <div className="chat-guest-note">
              <strong>Want to keep this chat?</strong>
              <p>This chat stays while this tab is open, so you can check an advocate or NGO and come back. Sign in to save your conversations for later.</p>
              <Link to="/login" className="chat-guest-btn"><LogIn size={15} /> Log in or sign up</Link>
            </div>
          )}
          <div className="chat-side-spacer" />

          <div className="chat-side-card ll-on-dark">
            <strong>Need a real advocate?</strong>
            <p>{assistant.name} gives general guidance. For your case, talk to a verified advocate or a free legal aid NGO.</p>
            <Link to="/lawyers" className="chat-side-link">Find advocates <ArrowRight size={14} /></Link>
            <Link to="/ngos" className="chat-side-link">Free legal aid <ArrowRight size={14} /></Link>
          </div>
        </aside>
        {sidebarOpen && <div className="chat-scrim" onClick={() => setSidebarOpen(false)} />}

        {/* ───────── Conversation ───────── */}
        <section className="chat-main">
          <header className="chat-topbar">
            <button type="button" className="chat-icon-btn chat-menu" onClick={() => setSidebarOpen(true)} aria-label="Open history">
              <PanelLeft size={18} />
            </button>
            <div className="chat-topbar-title">
              <img src={images.logo} alt="" />
              <div>
                <strong>{isEmpty ? assistant.name : currentTitle}</strong>
                <span><span className="chat-online" /> {assistant.name} · {assistant.tagline}</span>
              </div>
            </div>
            <button type="button" className="chat-icon-btn" onClick={startNewChat} aria-label="New conversation" title="New conversation">
              <Plus size={18} />
            </button>
          </header>

          <div className="chat-scroll" ref={scrollRef}>
            <div className="chat-thread">
              {isEmpty ? (
                <div className="chat-empty">
                  <span className="chat-empty-logo"><img src={images.logo} alt="" /></span>
                  <h1>
                    <em>Ask</em> {assistant.name}
                  </h1>
                  <span className="chat-empty-tag">{assistant.tagline} · {assistant.meaning}</span>
                  <p>{WELCOME.split('\n\n')[1]}</p>
                  <div className="chat-starters">
                    {STARTERS.map(({ icon: Icon, title, text }) => (
                      <button key={title} type="button" className="chat-starter" onClick={() => send(text)}>
                        <span className="chat-starter-icon"><Icon size={17} /></span>
                        <span>
                          <strong>{title}</strong>
                          <small>{text}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((m, idx) =>
                  m.role === 'model' && !m.content ? null : m.role === 'user' ? (
                    <div key={idx} className="chat-row is-user">
                      <div className="chat-bubble">{m.content}</div>
                    </div>
                  ) : (
                    <div key={idx} className={`chat-row is-ai${m.isError ? ' is-error' : ''}`}>
                      <span className="chat-avatar"><img src={images.logo} alt="" /></span>
                      <div className="chat-ai">
                        <span className="chat-ai-name">{assistant.name}</span>
                        {((m.legalCategory && m.legalCategory !== 'General') || m.urgency) && (
                          <div className="chat-tags">
                            {m.legalCategory && m.legalCategory !== 'General' && <span className="chat-tag">{m.legalCategory}</span>}
                            {m.urgency && /high|urgent/i.test(m.urgency) && <span className="chat-tag is-urgent">Urgent</span>}
                          </div>
                        )}
                        <div className="chat-ai-text">
                          <Formatted content={streamingIdx === idx ? tidyPartial(m.content) : m.content} />
                          {streamingIdx === idx && <span className="chat-caret" aria-hidden="true" />}
                        </div>
                        {streamingIdx !== idx && <Suggestions m={m} onNavigate={navigate} />}
                        {streamingIdx !== idx && (
                        <div className="chat-ai-foot">
                          <span className="chat-time">{timeLabel(m.timestamp)}</span>
                          {!m.isWelcome && m.content && (
                            <button type="button" className="chat-copy" onClick={() => copyMessage(m.content, idx)} aria-label="Copy answer">
                              {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          )}
                        </div>
                        )}
                      </div>
                    </div>
                  )
                )
              )}

              {isLoading && (
                <div className="chat-row is-ai">
                  <span className="chat-avatar"><img src={images.logo} alt="" /></span>
                  <div className="chat-typing" aria-label={`${assistant.name} is typing`}><span /><span /><span /></div>
                </div>
              )}
            </div>
          </div>

          {/* Composer stays fixed at the bottom; only the messages above scroll */}
          <div className="chat-composer-wrap">
            <form
              className="chat-composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={`Ask ${assistant.name} in English or Roman Urdu…`}
                aria-label="Message"
                autoFocus
              />
              <button type="submit" className="chat-send" disabled={!input.trim() || isLoading} aria-label="Send">
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            </form>
            <p className="chat-disclaimer">
              {assistant.name} gives general information, not legal advice. For your case, consult a verified advocate.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ChatbotPage;
