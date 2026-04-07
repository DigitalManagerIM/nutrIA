import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import NuriAvatar from '../components/nuri/NuriAvatar';
import BottomNav from '../components/common/BottomNav';

interface Message { id: string; role: 'user' | 'assistant' | 'action'; content: string; createdAt: string; ok?: boolean; }

const QUICK_ACTIONS = [
  { label: '¿Cómo voy hoy?',      message: '¿Cómo llevo el día de hoy en cuanto a calorías y macros?' },
  { label: '¿Qué como ahora?',    message: '¿Qué me recomiendas comer ahora mismo para llegar a mi objetivo?' },
  { label: 'Analiza mi progreso', message: 'Analiza mi progreso reciente de peso y dime cómo voy respecto a mi objetivo.' },
  { label: 'Consejo de hoy',      message: '¿Qué consejo nutricional me das para hoy basándote en mis datos?' },
  { label: 'Mi analítica',        message: 'Explícame mis valores de analítica de sangre y qué debería hacer al respecto.' },
  { label: 'Proteína pendiente',  message: '¿Cuánta proteína me falta hoy y qué alimentos me recomiendas para completarla?' },
];

export default function ChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showActions, setShowActions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    api.get('/chat/history?limit=30').then(({ data }) => {
      setMessages(data.data.messages);
      if (data.data.messages.length > 0) setShowActions(false);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const send = async (overrideContent?: string) => {
    const content = overrideContent || input.trim();
    if (!content && !file) return;
    setInput('');
    setShowActions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content || '📷 Imagen adjunta',
      createdAt: new Date().toISOString(),
    };
    setMessages(m => [...m, userMsg]);
    setStreaming(true);
    setStreamingText('');

    const currentFile = file;
    setFile(null);
    setFilePreview(null);

    try {
      const form = new FormData();
      form.append('content', content || 'Mira esta imagen');
      if (currentFile) form.append('image', currentFile);

      const token = localStorage.getItem('accessToken');
      const apiBase = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${apiBase}/chat/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = '';

      let executedActions: Array<{ type: string; label: string; ok: boolean }> = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done) {
              if (json.actions?.length > 0) executedActions = json.actions;
              break;
            }
            if (json.delta) { full += json.delta; setStreamingText(full); }
          } catch { /* partial SSE chunk */ }
        }
      }

      const now = new Date().toISOString();
      const newMessages: Message[] = [
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: full || '¡Ups! Se me ha ido la onda. Inténtalo de nuevo, ¿vale?',
          createdAt: now,
        },
        ...executedActions.map((a, i) => ({
          id: (Date.now() + 2 + i).toString(),
          role: 'action' as const,
          content: a.label,
          createdAt: now,
          ok: a.ok,
        })),
      ];
      setMessages(m => [...m, ...newMessages]);
    } catch {
      setMessages(m => [...m, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '¡Ups! Se me ha ido la onda. Inténtalo de nuevo, ¿vale?',
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setStreaming(false);
      setStreamingText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; }
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-screen bg-bg-light">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-[#0096B7] px-4 pt-10 pb-3 flex items-center gap-3 flex-shrink-0">
        <NuriAvatar state="chat" size={44} animate={false} />
        <div className="flex-1">
          <h1 className="text-white font-extrabold text-lg leading-tight">NutrIA</h1>
          <p className="text-white/70 text-xs">Tu coach de nutrición y entreno</p>
        </div>
        <button onClick={() => navigate('/goals')}
          className="text-white/80 text-xs bg-white/15 px-3 py-1.5 rounded-full font-medium active:bg-white/25">
          🎯 Objetivos
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-36">
        {loading && (
          <div className="flex justify-center py-10">
            <div className="text-3xl animate-bounce">🦦</div>
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <NuriAvatar state="chat" size={90} />
            <p className="text-gray-700 font-bold text-lg">¡Hola! Soy NutrIA 🦦</p>
            <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
              Conozco tu perfil completo: macros, peso, analítica y objetivos. Pregúntame lo que quieras.
            </p>
          </div>
        )}

        {messages.map(msg => {
          if (msg.role === 'action') {
            return (
              <motion.div key={msg.id} className="flex justify-center"
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${msg.ok !== false ? 'bg-secondary/15 text-secondary' : 'bg-alert/15 text-alert'}`}>
                  {msg.content}
                </span>
              </motion.div>
            );
          }
          return (
            <motion.div key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end gap-2'}`}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {msg.role === 'assistant' && (
                <NuriAvatar state="chat" size={30} animate={false} className="mb-1 flex-shrink-0" />
              )}
              <div className={`max-w-[82%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                ${msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white shadow-card text-gray-700 rounded-bl-sm font-medium'}`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-gray-300'}`}>
                  {formatTime(msg.createdAt)}
                </p>
              </div>
            </motion.div>
          );
        })}

        {streaming && (
          <motion.div className="flex items-end gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <NuriAvatar state="thinking" size={30} animate={false} className="mb-1 flex-shrink-0" />
            <div className="max-w-[82%] px-4 py-3 rounded-2xl bg-white shadow-card text-gray-700 text-sm font-medium rounded-bl-sm">
              {streamingText ? (
                <p className="whitespace-pre-wrap">{streamingText}</p>
              ) : (
                <span className="flex gap-1 py-1">
                  {[0, 1, 2].map(i => (
                    <motion.span key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full inline-block"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }} />
                  ))}
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Quick action chips */}
        <AnimatePresence>
          {showActions && !streaming && (
            <motion.div className="space-y-2 pt-2"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className="text-xs text-gray-400 text-center">Preguntas rápidas</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_ACTIONS.map(qa => (
                  <motion.button key={qa.label}
                    onClick={() => send(qa.message)}
                    className="text-xs bg-white border border-gray-200 text-gray-600 font-medium px-3 py-1.5 rounded-full shadow-sm active:bg-primary/10 active:border-primary active:text-primary transition-colors"
                    whileTap={{ scale: 0.95 }}>
                    {qa.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-app bg-white border-t border-gray-100 px-3 py-2 space-y-1.5">
        <AnimatePresence>
          {filePreview && (
            <motion.div className="flex items-center gap-2 px-1"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <img src={filePreview} alt="adjunto" className="w-10 h-10 object-cover rounded-lg border border-gray-200" />
              <span className="text-xs text-gray-400 flex-1">Imagen lista para enviar</span>
              <button onClick={() => { setFile(null); setFilePreview(null); }}
                className="text-alert font-bold text-lg leading-none">×</button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()}
            className="text-xl min-w-[40px] min-h-[40px] flex items-center justify-center text-gray-300 active:text-primary flex-shrink-0">
            📷
          </button>
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none border-2 border-gray-200 rounded-2xl px-3 py-2 text-sm focus:border-primary focus:outline-none min-h-[40px] leading-relaxed bg-white"
            placeholder="Escríle a NutrIA..."
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <motion.button
            onClick={() => send()}
            disabled={streaming || (!input.trim() && !file)}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
            whileTap={{ scale: 0.9 }}>
            {streaming ? '⏳' : '➤'}
          </motion.button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
