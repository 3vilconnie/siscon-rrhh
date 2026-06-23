'use client';
import { useEffect, useState, useRef } from 'react'; // 👈 Agregamos useRef
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface AlertaNotificacion {
  rut: number;
  nombreCompleto: string;
  leida: boolean;
}

export default function NavbarSuperior() {
  const router = useRouter();
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1. Creamos la referencia para el contenedor de la campanita
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consultarAlertasConBrecha = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trabajadores')
          .select(`
            rut,
            dv,
            nombres,
            primer_apellido,
            segundo_apellido,
            contratos(id, fecha_inicio, fecha_termino)
          `);

        if (!error && data) {
          const hoy = new Date();
          const quinceMesesAtras = new Date();
          quinceMesesAtras.setMonth(quinceMesesAtras.getMonth() - 15);

          const listadoCalculado: Omit<AlertaNotificacion, 'leida'>[] = [];

          data.forEach((t: any) => {
            if (t.contratos && t.contratos.length >= 2) {
              const contratosVentana = t.contratos
                .filter((c: any) => new Date(c.fecha_inicio) >= quinceMesesAtras)
                .sort((a: any, b: any) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());

              const tieneContratoActivo = contratosVentana.some((c: any) => {
                if (!c.fecha_termino) return true;
                const fTermino = new Date(c.fecha_termino);
                fTermino.setHours(0, 0, 0, 0);
                const hoySinHoras = new Date(hoy);
                hoySinHoras.setHours(0, 0, 0, 0);
                return fTermino >= hoySinHoras;
              });

              let contratosConsecutivosMax = 0;
              let rachaActual = 0;

              if (contratosVentana.length > 0) {
                rachaActual = 1;
                contratosConsecutivosMax = 1;

                for (let i = 1; i < contratosVentana.length; i++) {
                  const contratoPrevio = contratosVentana[i - 1];
                  const contratoActual = contratosVentana[i];

                  if (contratoPrevio.fecha_termino) {
                    const finPrevio = new Date(contratoPrevio.fecha_termino);
                    const inicioActual = new Date(contratoActual.fecha_inicio);
                    const diferenciaTiempo = inicioActual.getTime() - finPrevio.getTime();
                    const diferenciaMeses = diferenciaTiempo / (1000 * 60 * 60 * 24 * 30.44);

                    if (diferenciaMeses < 3) {
                      rachaActual++;
                      if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
                    } else {
                      rachaActual = 1;
                    }
                  } else {
                    rachaActual++;
                    if (rachaActual > contratosConsecutivosMax) contratosConsecutivosMax = rachaActual;
                  }
                }
              }

              if (contratosConsecutivosMax >= 2 && tieneContratoActivo) {
                const constMaterno = t.segundo_apellido ? ` ${t.segundo_apellido}` : '';
                listadoCalculado.push({
                  rut: t.rut,
                  nombreCompleto: `${t.primer_apellido}${constMaterno} ${t.nombres}`.toUpperCase()
                });
              }
            }
          });

          const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
          const rutsLeidos: number[] = estadosLecturaGuardados ? JSON.parse(estadosLecturaGuardados) : [];

          const alertasMapeadas: AlertaNotificacion[] = listadoCalculado.map(item => ({
            ...item,
            leida: rutsLeidos.includes(item.rut)
          }));

          setAlertas(alertasMapeadas);
        }
      } catch (err) {
        console.error('Error calculando alertas individuales:', err);
      } finally {
        setLoading(false);
      }
    };

    consultarAlertasConBrecha();
  }, []);

  // 2. Efecto global para detectar clics externos y cerrar el menú
  useEffect(() => {
    const manejarClicExterno = (evento: MouseEvent) => {
      // Si el menú está abierto y el clic NO se realizó dentro del contenedorRef, lo cerramos
      if (
        menuAbierto &&
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setMenuAbierto(false);
      }
    };

    // Escuchar clics en toda la ventana
    window.addEventListener('mousedown', manejarClicExterno);
    
    // Limpieza al desmontar el componente
    return () => {
      window.removeEventListener('mousedown', manejarClicExterno);
    };
  }, [menuAbierto]);

  const clickAlerta = (rut: number) => {
    const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
    const rutsLeidos: number[] = estadosLecturaGuardados ? JSON.parse(estadosLecturaGuardados) : [];
    
    if (!rutsLeidos.includes(rut)) {
      rutsLeidos.push(rut);
      localStorage.setItem('siscon_alertas_leidas', JSON.stringify(rutsLeidos));
    }

    setAlertas(prev => prev.map(a => a.rut === rut ? { ...a, leida: true } : a));
    setMenuAbierto(false);
    
    router.push(`/dashboard/alertas?focusRut=${rut}`);
  };

  const conteoNoLeidas = alertas.filter(a => !a.leida).length;

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom px-4 py-2 d-flex justify-content-between align-items-center position-relative shadow-sm">
      <div className="fw-bold text-secondary small text-uppercase">
        Sistema de Control de Contratos (siscon)
      </div>

      {/* 3. Vinculamos la referencia 'ref={contenedorRef}' al div padre de la campana */}
      <div className="position-relative" ref={contenedorRef}>
        <button 
          className="btn btn-light position-relative rounded-circle p-2"
          onClick={() => setMenuAbierto(!menuAbierto)}
        >
          <i className="bi bi-bell-fill fs-5 text-dark"></i>
          {conteoNoLeidas > 0 && (
            <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger animate-bounce" style={{ fontSize: '10px' }}>
              {conteoNoLeidas}
            </span>
          )}
        </button>

        {menuAbierto && (
          <div className="position-absolute end-0 mt-2 card shadow-lg border-0" style={{ width: '340px', zIndex: 1050, top: '100%' }}>
            <div className="card-header bg-dark text-white fw-bold small py-2 d-flex justify-content-between align-items-center">
              <span>Advertencias por Trabajador</span>
              <span className="badge bg-warning text-dark">{conteoNoLeidas} nuevas</span>
            </div>
            
            <div className="card-body p-0 overflow-auto" style={{ maxHeight: '320px' }}>
              {loading ? (
                <div className="text-center py-3 text-muted small">Evaluando historiales...</div>
              ) : alertas.length === 0 ? (
                <div className="text-center py-4 text-muted small">No hay advertencias registradas</div>
              ) : (
                alertas.map((a) => (
                  <div 
                    key={a.rut} 
                    className={`p-3 border-bottom position-relative transition-all d-flex flex-column gap-1 ${a.leida ? 'bg-white opacity-75' : 'bg-warning bg-opacity-10'}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => clickAlerta(a.rut)}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span className={`fw-bold text-truncate small ${a.leida ? 'text-muted' : 'text-dark'}`} style={{ maxWidth: '210px' }}>
                        {a.nombreCompleto}
                      </span>
                      {!a.leida && <span className="spinner-grow bg-primary rounded-circle" style={{ width: '8px', height: '8px' }}></span>}
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-1" style={{ fontSize: '0.72rem' }}>
                      <span className="text-muted font-monospace">RUT: {a.rut}</span>
                      <span className="text-primary fw-bold">Revisar y enfocar →</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="card-footer p-0 text-center border-top">
              <Link href="/dashboard/alertas" className="d-block w-100 py-2 text-secondary fw-semibold small text-decoration-none bg-light" onClick={() => setMenuAbierto(false)}>
                Ver Panel de Advertencias Completo
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}