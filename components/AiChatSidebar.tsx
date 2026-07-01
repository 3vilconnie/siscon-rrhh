'use client';
import { useState, useEffect, useRef } from 'react';

interface MensajeChat {
  rol: 'user' | 'assistant';
  texto: string;
}

export default function AiChatSidebar() {
  const [minimizado, setMinimizado] = useState(false);
  const [expandido, setExpanded] = useState(false); 
  const [isTyping, setIsTyping] = useState(false); 
  const [input, setInput] = useState('');
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { 
      rol: 'assistant', 
      texto: '¡Hola! Soy el asistente analítico de siscon RRHH. Puedo ayudarte a auditar las fichas de personal, revisar sueldos y consultar el historial acumulado en Supabase.' 
    }
  ]);

  // UX: Burbujas inteligentes de un solo clic con consultas comunes de ejemplo
  const sugerenciasIniciales = [
    { titulo: '📄 Contratos de Julia', query: 'cuantos contratos tiene julia alcon' },
    { titulo: '🔍 Datos de Julia', query: 'datos de julia alcon' },
    { titulo: '⚠️ Ver panel de alertas', query: '¿Qué alertas de continuidad hay vigentes?' }
  ];

  const finMensajesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!minimizado) {
      finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, minimizado, isTyping]);

  const realizarConsultaChat = async (textoEnviar: string) => {
    if (!textoEnviar.trim() || isTyping) return;

    const nuevoMensajeUsuario: MensajeChat = { rol: 'user', texto: textoEnviar };
    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setInput('');
    setIsTyping(true); 

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: textoEnviar }),
      });

      const data = await response.json();
      setMensajes((prev) => [...prev, { rol: 'assistant', texto: data.respuesta }]);
    } catch (err) {
      setMensajes((prev) => [...prev, { 
        rol: 'assistant', 
        texto: 'Lo siento, ocurrió un error de conexión al consultar la base de datos analítica.' 
      }]);
    } finally {
      setIsTyping(false); 
    }
  };

  const handleEnviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    realizarConsultaChat(input);
  };

  const chatWidth = expandido ? '450px' : '340px';

  return (
    <>
      <style>{`
        .typing-indicator span {
          display: inline-block;
          width: 6px;
          height: 6px;
          background-color: #6c757d;
          border-radius: 50%;
          margin: 0 2px;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
        .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        .burbuja-sugerencia:hover {
          background-color: #e9ecef !important;
          border-color: #0d6efd !important;
          color: #0d6efd !important;
        }
      `}</style>

      <div 
        className="position-fixed shadow-lg border rounded-top bg-white"
        style={{
          bottom: 0,
          right: '24px',
          width: chatWidth,
          zIndex: 1050,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: minimizado ? 'translateY(calc(100% - 45px))' : 'translateY(0)'
        }}
      >
        {/* BARRA DE TÍTULO */}
        <div 
          className="card-header bg-dark text-white d-flex justify-content-between align-items-center px-3 py-2 cursor-pointer"
          style={{ height: '45px', userSelect: 'none' }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) return;
            setMinimizado(!minimizado);
          }}
        >
          <div className="d-flex align-items-center gap-2 small fw-bold text-uppercase tracking-wider">
            <span className="position-relative d-inline-block" style={{ width: '8px', height: '8px' }}>
              <span className="position-absolute top-0 start-0 w-100 h-100 bg-success rounded-circle animate-ping"></span>
              <span className="position-absolute top-0 start-0 w-100 h-100 bg-success rounded-circle"></span>
            </span>
            <i className="bi bi-robot me-1"></i> Asistente IA
          </div>
          
          <div className="d-flex gap-1">
            {!minimizado && (
              <button 
                className="btn btn-sm text-white-50 p-1 border-0 hover-white" 
                onClick={() => setExpanded(!expandido)}
                title={expandido ? "Reducir ancho" : "Expandir ancho"}
              >
                <i className={`bi ${expandido ? 'bi-arrows-angle-contract' : 'bi-arrows-angle-expand'}`}></i>
              </button>
            )}
            <button 
              className="btn btn-sm text-white p-1 border-0"
              onClick={() => setMinimizado(!minimizado)}
            >
              <i className={`bi ${minimizado ? 'bi-chevron-up' : 'bi-dash-lg fw-bold'}`}></i>
            </button>
          </div>
        </div>

        {/* CUERPO DEL CHAT */}
        <div className="d-flex flex-column" style={{ height: expandido ? '500px' : '400px', transition: 'height 0.3s' }}>
          
          <div className="p-3 flex-grow-1 overflow-auto bg-light small" style={{ height: '100%' }}>
            {mensajes.map((msg, idx) => (
              <div 
                key={idx} 
                className={`d-flex mb-3 ${msg.rol === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
              >
                <div 
                  className="p-2 px-3 shadow-sm" 
                  style={{ 
                    maxWidth: '85%',
                    backgroundColor: msg.rol === 'user' ? '#0d6efd' : '#ffffff',
                    color: msg.rol === 'user' ? '#ffffff' : '#212529',
                    borderRadius: msg.rol === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                    whiteSpace: 'pre-line'
                  }}
                >
                  {(() => {
                    const partes = msg.texto.split(/(\*\*.*?\*\*)/g);
                    return partes.map((parte, i) => {
                      if (parte.startsWith('**') && parte.endsWith('**')) {
                        return <strong key={i}>{parte.slice(2, -2)}</strong>;
                      }
                      return <span key={i}>{parte}</span>;
                    });
                  })()}
                </div>
              </div>
            ))}

            {/* UX: MOSTRAR BURBUJAS DE SUGERENCIAS SOLO SI ESTÁ EL MENSAJE INICIAL */}
            {mensajes.length === 1 && !isTyping && (
              <div className="mt-3 animate__animated animate__fadeIn">
                <span className="text-muted d-block mb-2 font-monospace" style={{ fontSize: '10px' }}>💡 CONSULTAS RÁPIDAS SUGERIDAS:</span>
                <div className="d-flex flex-column gap-2">
                  {sugerenciasIniciales.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => realizarConsultaChat(sug.query)}
                      className="btn btn-sm btn-white text-start border shadow-sm p-2 bg-white burbuja-sugerencia text-secondary fw-medium transition-all"
                      style={{ fontSize: '11px', borderRadius: '8px' }}
                    >
                      <i className="bi bi-chat-left-text me-2 text-primary"></i>
                      {sug.titulo}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Animación de "Escribiendo..." */}
            {isTyping && (
              <div className="d-flex justify-content-start mb-3">
                <div 
                  className="p-2 px-3 shadow-sm d-flex align-items-center" 
                  style={{ backgroundColor: '#ffffff', borderRadius: '12px 12px 12px 0', height: '38px' }}
                >
                  <div className="typing-indicator d-flex align-items-center">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}

            <div ref={finMensajesRef} />
          </div>

          {/* Input de Texto Inferior */}
          <form onSubmit={handleEnviar} className="p-2 border-top bg-white d-flex gap-2 align-items-center">
            <input 
              type="text" 
              className="form-control form-control-sm border-0 bg-light"
              placeholder={isTyping ? "Esperando respuesta..." : "Ej: ¿Cuántos contratos tiene Carmen Zuñiga?"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              style={{ borderRadius: '20px', paddingLeft: '15px' }}
            />
            <button 
              type="submit" 
              className="btn btn-sm btn-primary rounded-circle d-flex justify-content-center align-items-center"
              style={{ width: '32px', height: '32px', minWidth: '32px' }}
              disabled={isTyping || !input.trim()}
            >
              <i className="bi bi-send-fill" style={{ marginLeft: '-2px' }}></i>
            </button>
          </form>

        </div>
      </div>
    </>
  );
}