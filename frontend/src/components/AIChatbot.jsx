import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../contexts/ThemeContext';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { API_URL } from "../config";

const AIChatbot = () => {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { 
      role: 'model', 
      content: "Assalam-o-Alaikum! I'm LegalLink AI Assistant. I understand English and Urdu. How can I help you with your legal matter today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(scrollToBottom, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/chat/message`, {
        message: userMessage.content,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      });

      const aiMessage = { 
        role: 'model', 
        content: response.data.reply || response.data.response || "I have received your inquiry.", 
        timestamp: new Date() 
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage = { 
        role: 'model', 
        content: "Sorry, I'm having trouble connecting right now. Please try again or contact our support team.",
        timestamp: new Date(),
        isError: true 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 3D Floating AI Orb Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ll-float-3d"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '62px',
          height: '62px',
          borderRadius: '50%',
          background: isDark
            ? 'linear-gradient(135deg, #10B981, #047857)'
            : 'linear-gradient(135deg, #1E3F2E, #152E22)',
          color: '#FFFFFF',
          border: isDark ? '2px solid rgba(212, 175, 55, 0.4)' : '2px solid rgba(255, 255, 255, 0.4)',
          cursor: 'pointer',
          boxShadow: isDark
            ? '0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(16, 185, 129, 0.35)'
            : '0 10px 25px rgba(30, 63, 46, 0.35), 0 0 15px rgba(212, 175, 55, 0.2)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          outline: 'none',
          transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        title="Open AI Legal Assistant"
        aria-label="Toggle AI Chat"
      >
        {isOpen ? <X size={24} /> : <Bot size={28} />}
      </button>

      {/* 3D Glassmorphic Chat Window */}
      {isOpen && (
        <div
          className="ll-glass-card"
          style={{
            position: 'fixed',
            bottom: '98px',
            right: '24px',
            width: '380px',
            maxWidth: 'calc(100vw - 48px)',
            height: '540px',
            borderRadius: '24px',
            boxShadow: isDark
              ? '0 25px 60px rgba(0,0,0,0.8), 0 0 30px rgba(212, 175, 55, 0.2)'
              : '0 20px 50px rgba(15, 23, 42, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
            border: isDark ? '1px solid rgba(212, 175, 55, 0.35)' : '1px solid #E2E8F0',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: isDark
                ? 'linear-gradient(135deg, rgba(22, 34, 52, 0.98), rgba(14, 21, 33, 0.98))'
                : 'linear-gradient(135deg, #1E3F2E, #152E22)',
              color: '#FFFFFF',
              padding: '16px 20px',
              borderBottom: '1px solid var(--ll-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div className="d-flex align-items-center gap-2">
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Bot size={18} />
              </div>
              <div>
                <h6 style={{ margin: 0, fontWeight: 700, fontSize: '14px', letterSpacing: '0.01em' }}>
                  LegalLink AI Assistant
                </h6>
                <small style={{ opacity: 0.8, fontSize: '11px' }}>
                  English & Roman Urdu Legal Guidance
                </small>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#FFFFFF',
                cursor: 'pointer',
                opacity: 0.8,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              background: isDark ? 'rgba(8, 13, 21, 0.95)' : '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '11px 15px',
                      borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
                      background: isUser
                        ? isDark
                          ? 'linear-gradient(135deg, #10B981, #059669)'
                          : 'linear-gradient(135deg, #1E3F2E, #152E22)'
                        : isDark
                          ? '#1A2333'
                          : '#FFFFFF',
                      color: isUser
                        ? isDark ? '#052317' : '#FFFFFF'
                        : 'var(--ll-text-primary)',
                      border: isUser ? 'none' : '1px solid var(--ll-border)',
                      boxShadow: 'var(--ll-shadow-sm)',
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}
                  >
                    <div>{msg.content}</div>
                    <div
                      style={{
                        fontSize: '9.5px',
                        marginTop: '6px',
                        opacity: 0.65,
                        textAlign: isUser ? 'right' : 'left',
                      }}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  className="ll-glass-card p-2 px-3 d-flex align-items-center gap-2"
                  style={{ borderRadius: '14px', fontSize: '12px' }}
                >
                  <Sparkles size={13} className="text-warning" />
                  <span>AI Legal Counsel is drafting response...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={sendMessage}
            style={{
              padding: '12px 14px',
              borderTop: '1px solid var(--ll-border)',
              background: isDark ? '#111827' : '#FFFFFF',
              display: 'flex',
              gap: '8px',
            }}
          >
            <input
              type="text"
              className="ll-input-3d"
              placeholder="Ask a legal question in English or Urdu..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              style={{
                borderRadius: '14px',
                padding: '9px 14px',
                fontSize: '13px',
              }}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="ll-btn-3d ll-btn-3d-primary"
              style={{
                borderRadius: '14px',
                padding: '8px 16px',
              }}
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AIChatbot;
