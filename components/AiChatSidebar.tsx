'use client';
import { useState, useEffect, useRef } from 'react';

interface MensajeChat {
  rol: 'user' | 'assistant';
  texto: string;
}

export default function AiChatSidebar() {
  const [minimizado, setMinimizado] = useState(false);
  const [expandido, setExpanded] = useState(false); // <-- Nuevo estado para el ancho
  const [isTyping, setIsTyping] = useState(false); // <-- Nuevo estado para animación de carga
  const [input, setInput] = useState('');
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { rol: 'assistant', texto: '¡Hola! Soy el asistente de siscon RRHH. Puedes pedirme buscar fichas de personal, sueldos o ver quiénes están en alerta legal de 15 meses.' }
  ]);

  const finMensajesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!minimizado) {
      finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, minimizado, isTyping]); // Agregamos isTyping a la dependencia del scroll

  const handleEnviar = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const mensajeUsuario = input;
    const nuevoMensajeUsuario: MensajeChat = { rol: 'user', texto: mensajeUsuario };
    
    setMensajes((prev) => [...prev, nuevoMensajeUsuario]);
    setInput('');
    setIsTyping(true); // Activar animación de "escribiendo..."

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensajeUsuario }),
      });

      const data = await response.json();
      setMensajes((prev) => [...prev, { rol: 'assistant', texto: data.respuesta }]);
    } catch (err) {
      setMensajes((prev) => [...prev, { 
        rol: 'assistant', 
        texto: 'Lo siento, ocurrió un error de conexión al consultar la base de datos.' 
      }]);
    } finally {
      setIsTyping(false); // Apagar la animación al terminar
    }
  };

  // Determinar el ancho actual basado en el estado
  const chatWidth = expandido ? '450px' : '340px';

  return (
    <>
      {/* CSS inyectado para la animación de los 3 puntos */}
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
            // Prevenir que el click en los botones dispare el minimizar
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
            {/* Botón para Expandir/Contraer ancho */}
            {!minimizado && (
              <button 
                className="btn btn-sm text-white-50 p-1 border-0 hover-white" 
                onClick={() => setExpanded(!expandido)}
                title={expandido ? "Reducir ancho" : "Expandir ancho"}
              >
                <i className={`bi ${expandido ? 'bi-arrows-angle-contract' : 'bi-arrows-angle-expand'}`}></i>
              </button>
            )}
            {/* Botón para Minimizar chat */}
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
          
          {/* Contenedor de Historial de Mensajes */}
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
                  // Reemplaza la línea donde dice {msg.texto} dentro de tu map, por esto:

                {/* Función auxiliar para renderizar negritas */}
                {(() => {
                  // Separa el texto usando una expresión regular para capturar lo que está entre ** **
                  const partes = msg.texto.split(/(\*\*.*?\*\*)/g);
                  return partes.map((parte, i) => {
                    if (parte.startsWith('**') && parte.endsWith('**')) {
                      // Le quita los asteriscos y lo envuelve en <strong>
                      return <strong key={i}>{parte.slice(2, -2)}</strong>;
                    }
                    return <span key={i}>{parte}</span>;
                  });
                })()}
                </div>
              </div>
            ))}

            {/* Animación de "Escribiendo..." */}
            {isTyping && (
              <div className="d-flex justify-content-start mb-3">
                <div 
                  className="p-2 px-3 shadow-sm d-flex align-items-center" 
                  style={{ 
                    backgroundColor: '#ffffff', 
                    borderRadius: '12px 12px 12px 0',
                    height: '38px'
                  }}
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
              placeholder="Ej: ¿Quién gana más de 800.000?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isTyping}
              style={{ borderRadius: '20px', paddingLeft: '15px' }}
            />
            <button 
              type="submit" 
              className="btn btn-sm btn-primary rounded-circle d-flex justify-content-center align-items-center"
              style={{ width: '32px', height: '32px' }}
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