'use client';
import { useState, useEffect, useRef } from 'react';

interface MensajeChat {
  rol: 'user' | 'assistant';
  texto: string;
}

export default function AiChatSidebar() {
  const [minimizado, setMinimizado] = useState(false);
  const [input, setInput] = useState('');
  const [mensajes, setMensajes] = useState<MensajeChat[]>([
    { rol: 'assistant', texto: '¡Hola! Soy el asistente de siscon RRHH. Puedes pedirme buscar fichas de personal, sueldos o ver quiénes están en alerta legal de 15 meses.' }
  ]);

  // 1. REFERENCIA PARA EL ANCLA DEL FINAL DEL CHAT
  const finMensajesRef = useRef<HTMLDivElement>(null);

  // 2. EFECTO QUE SE DISPARA CADA VEZ QUE ENTRA UN MENSAJE NUEVO
  useEffect(() => {
    if (!minimizado) {
      finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mensajes, minimizado]); // Se activa si cambia el historial o si maximizas el chat

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const mensajeUsuario = input;
    const nuevoMensajeUsuario: MensajeChat = { rol: 'user', texto: mensajeUsuario };
    const nuevosMensajes = [...mensajes, nuevoMensajeUsuario];
    
    setMensajes(nuevosMensajes);
    setInput('');

    // Mensaje temporal de espera
    const mensajeEspera: MensajeChat = { rol: 'assistant', texto: 'Buscando en la base de datos...' };
    setMensajes([...nuevosMensajes, mensajeEspera]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: mensajeUsuario }),
      });

      const data = await response.json();
      setMensajes([...nuevosMensajes, { rol: 'assistant', texto: data.respuesta }]);
    } catch (err) {
      setMensajes([...nuevosMensajes, { 
        rol: 'assistant', 
        texto: 'Lo siento, ocurrió un error de conexión al consultar la base de datos.' 
      }]);
    }
  };

  return (
    <div 
      className="position-fixed shadow-lg border rounded-top bg-white"
      style={{
        bottom: 0,
        right: '24px',
        width: '340px',
        zIndex: 1050,
        transition: 'all 0.25s ease-in-out',
        transform: minimizado ? 'translateY(calc(100% - 45px))' : 'translateY(0)'
      }}
    >
      {/* BARRA DE TÍTULO */}
      <div 
        className="card-header bg-dark text-white d-flex justify-content-between align-items-center px-3 py-2 cursor-pointer"
        style={{ height: '45px', userSelect: 'none' }}
        onClick={() => setMinimizado(!minimizado)}
      >
        <div className="d-flex align-items-center gap-2 small fw-bold text-uppercase tracking-wider">
          <span className="position-relative d-inline-block" style={{ width: '8px', height: '8px' }}>
            <span className="position-absolute top-0 start-0 w-100 h-100 bg-success rounded-circle animate-ping"></span>
            <span className="position-absolute top-0 start-0 w-100 h-100 bg-success rounded-circle"></span>
          </span>
          <i className="bi bi-robot me-1"></i> Asistente Analítico
        </div>
        <button className="btn btn-sm text-white p-0 border-0 bg-transparent">
          <i className={`bi ${minimizado ? 'bi-chevron-up' : 'bi-dash-lg fw-bold'}`}></i>
        </button>
      </div>

      {/* CUERPO DEL CHAT */}
      <div className="d-flex flex-column" style={{ height: '400px' }}>
        
        {/* Contenedor de Historial de Mensajes */}
        <div className="p-3 flex-grow-1 overflow-auto bg-light small" style={{ height: '340px' }}>
          {mensajes.map((msg, idx) => (
            <div 
              key={idx} 
              className={`d-flex mb-3 ${msg.rol === 'user' ? 'justify-content-end' : 'justify-content-start'}`}
            >
              <div 
                className="p-2 rounded shadow-sm" 
                style={{ 
                  maxWidth: '85%',
                  backgroundColor: msg.rol === 'user' ? '#0d6efd' : '#ffffff',
                  color: msg.rol === 'user' ? '#ffffff' : '#212529',
                  borderRadius: msg.rol === 'user' ? '12px 12px 0 12px' : '12px 12px 12px 0',
                  whiteSpace: 'pre-line'
                }}
              >
                {msg.texto}
              </div>
            </div>
          ))}

          {/* 3. DIV ANCLA INVISIBLE AL FINAL DEL CONTENEDOR */}
          <div ref={finMensajesRef} />
        </div>

        {/* Input de Texto Inferior */}
        <form onSubmit={handleEnviar} className="p-2 border-top bg-white d-flex gap-2">
          <input 
            type="text" 
            className="form-control form-control-sm"
            placeholder="Ej: ¿Quién gana más de 800.000?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="btn btn-sm btn-primary">
            <i className="bi bi-send"></i>
          </button>
        </form>

      </div>
    </div>
  );
}