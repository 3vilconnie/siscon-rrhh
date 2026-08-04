'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Navbar, Nav, Button, Badge, Card, Dropdown, Container } from 'react-bootstrap';
import { Trabajador, AlertaNotificacion } from '@/types';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';

interface NavbarSuperiorProps {
  nombreUsuario: string;
  ultimaConexion: string;
  rolUsuario: string;
  onCerrarSesion: (e: React.MouseEvent) => void;
}

export default function NavbarSuperior({
  nombreUsuario,
  ultimaConexion,
  rolUsuario,
  onCerrarSesion,
}: NavbarSuperiorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const consultarAlertasConBrecha = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trabajadores')
          .select(
            'rut, dv, nombres, primer_apellido, segundo_apellido, contratos(id, fecha_inicio, fecha_termino)',
          );

        if (!error && data) {
          const listadoCalculado: Omit<AlertaNotificacion, 'leida'>[] = [];

          (data as Trabajador[]).forEach((t) => {
            const analisis = evaluarAlertaContinuidad(t);

            if (analisis.califica) {
              listadoCalculado.push({
                rut: t.rut,
                nombreCompleto: `${t.primer_apellido} ${t.segundo_apellido || ''} ${t.nombres}`
                  .trim()
                  .toUpperCase(),
                totalContratos: analisis.totalContratos,
              });
            }
          });

          const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
          const rutsLeidos: number[] = estadosLecturaGuardados
            ? JSON.parse(estadosLecturaGuardados)
            : [];

          const alertasMapeadas: AlertaNotificacion[] = listadoCalculado.map((item) => ({
            ...item,
            leida: rutsLeidos.includes(item.rut),
          }));

          setAlertas(alertasMapeadas);
        }
      } catch (err) {
        console.error('Error calculando alertas:', err);
      } finally {
        setLoading(false);
      }
    };

    consultarAlertasConBrecha();
  }, []);

  useEffect(() => {
    const manejarClicExterno = (evento: MouseEvent) => {
      if (
        menuAbierto &&
        contenedorRef.current &&
        !contenedorRef.current.contains(evento.target as Node)
      ) {
        setMenuAbierto(false);
      }
    };
    window.addEventListener('mousedown', manejarClicExterno);
    return () => window.removeEventListener('mousedown', manejarClicExterno);
  }, [menuAbierto]);

  const clickAlerta = (rut: number) => {
    const estadosLecturaGuardados = localStorage.getItem('siscon_alertas_leidas');
    const rutsLeidos: number[] = estadosLecturaGuardados ? JSON.parse(estadosLecturaGuardados) : [];

    if (!rutsLeidos.includes(rut)) {
      rutsLeidos.push(rut);
      localStorage.setItem('siscon_alertas_leidas', JSON.stringify(rutsLeidos));
    }

    setAlertas((prev) => prev.map((a) => (a.rut === rut ? { ...a, leida: true } : a)));
    setMenuAbierto(false);
    router.push(`/dashboard/alertas?focusRut=${rut}`);
  };

  const conteoNoLeidas = alertas.filter((a) => !a.leida).length;

  const checkIsActive = (path: string) => pathname.includes(path);

  // Enlaces de navegación (antes vivían en el sidebar)
  const enlaces = [
    { href: '/dashboard/trabajadores', icon: 'bi-people', label: 'Trabajadores' },
    { href: '/dashboard/recepcion', icon: 'bi-book', label: 'Recepción' },
    { href: '/dashboard/documentos', icon: 'bi-file-earmark-word', label: 'Documentos' },
    { href: '/dashboard/formulario', icon: 'bi-person-plus', label: 'Registrar' },
    { href: '/dashboard/carga-masiva', icon: 'bi-cloud-arrow-up', label: 'Carga Masiva' },
    { href: '/dashboard/horas-compensatorias', icon: 'bi-clock-history', label: 'Horas Comp.' },
  ];

  const iniciales = nombreUsuario.substring(0, 2).toUpperCase();

  return (
    <Navbar
      bg="white"
      expand="lg"
      sticky="top"
      className="border-bottom shadow-sm py-2"
      style={{ zIndex: 1030 }}
    >
      <Container fluid className="px-4">
        <Navbar.Brand
          as={Link}
          href="/dashboard/trabajadores"
          className="text-info fw-bold d-flex align-items-center gap-2"
        >
          <i className="bi bi-cpu-fill"></i> siscon RRHH
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="siscon-navbar" />

        <Navbar.Collapse id="siscon-navbar">
          {/* NAVEGACIÓN PRINCIPAL */}
          <Nav className="me-auto gap-lg-1">
            {enlaces.map((e) => (
              <Nav.Link
                key={e.href}
                as={Link}
                href={e.href}
                active={checkIsActive(e.href)}
                className={`d-flex align-items-center gap-2 px-3 rounded ${checkIsActive(e.href) ? 'fw-bold text-primary bg-primary bg-opacity-10' : 'text-secondary'}`}
              >
                <i className={`bi ${e.icon}`}></i> {e.label}
              </Nav.Link>
            ))}
            {rolUsuario === 'admin' && (
              <Nav.Link
                as={Link}
                href="/dashboard/admin"
                active={checkIsActive('/dashboard/admin')}
                className={`d-flex align-items-center gap-2 px-3 rounded ${checkIsActive('/dashboard/admin') ? 'fw-bold text-dark bg-warning bg-opacity-25' : 'text-warning'}`}
              >
                <i className="bi bi-gear-fill"></i> Admin
              </Nav.Link>
            )}
          </Nav>

          {/* ZONA DERECHA: NOTIFICACIONES + USUARIO */}
          <div className="d-flex align-items-center gap-2">
            {/* CAMPANA DE NOTIFICACIONES */}
            <div className="position-relative" ref={contenedorRef}>
              <Button
                variant="light"
                className="position-relative rounded-circle p-2"
                onClick={() => setMenuAbierto(!menuAbierto)}
              >
                <i className="bi bi-bell-fill fs-5 text-dark"></i>
                {conteoNoLeidas > 0 && (
                  <Badge
                    pill
                    bg="danger"
                    className="position-absolute top-0 start-100 translate-middle animate-bounce"
                    style={{ fontSize: '10px' }}
                  >
                    {conteoNoLeidas}
                  </Badge>
                )}
              </Button>

              {menuAbierto && (
                <Card
                  className="position-absolute end-0 mt-2 shadow-lg border-0"
                  style={{ width: '340px', zIndex: 1050, top: '100%' }}
                >
                  <Card.Header className="bg-dark text-white fw-bold small py-2 d-flex justify-content-between align-items-center">
                    <span>Advertencias por Trabajador</span>
                    <Badge bg="warning" text="dark">
                      {conteoNoLeidas} nuevas
                    </Badge>
                  </Card.Header>

                  <Card.Body className="p-0 overflow-auto" style={{ maxHeight: '320px' }}>
                    {loading ? (
                      <div className="text-center py-3 text-muted small">
                        Evaluando historiales...
                      </div>
                    ) : alertas.length === 0 ? (
                      <div className="text-center py-4 text-muted small">
                        No hay advertencias registradas
                      </div>
                    ) : (
                      alertas.map((a) => (
                        <div
                          key={a.rut}
                          className={`p-3 border-bottom position-relative transition-all d-flex flex-column gap-1 ${a.leida ? 'bg-white opacity-75' : 'bg-warning bg-opacity-10'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => clickAlerta(a.rut)}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <span
                              className={`fw-bold text-truncate small ${a.leida ? 'text-muted' : 'text-dark'}`}
                              style={{ maxWidth: '210px' }}
                            >
                              {a.nombreCompleto}
                            </span>
                            {!a.leida && (
                              <span
                                className="spinner-grow bg-primary rounded-circle"
                                style={{ width: '8px', height: '8px' }}
                              ></span>
                            )}
                          </div>
                          <div
                            className="d-flex justify-content-between align-items-center mt-1"
                            style={{ fontSize: '0.72rem' }}
                          >
                            <span className="text-muted font-monospace">RUT: {a.rut}</span>
                            <span className="text-primary fw-bold">Revisar y enfocar →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </Card.Body>

                  <Card.Footer className="p-0 text-center border-top">
                    <Link
                      href="/dashboard/alertas"
                      className="d-block w-100 py-2 text-secondary fw-semibold small text-decoration-none bg-light"
                      onClick={() => setMenuAbierto(false)}
                    >
                      Ver Panel de Advertencias Completo
                    </Link>
                  </Card.Footer>
                </Card>
              )}
            </div>

            {/* DROPDOWN DE USUARIO */}
            <Dropdown align="end">
              <Dropdown.Toggle
                variant="light"
                id="user-dropdown"
                className="d-flex align-items-center gap-2 border-0 bg-transparent shadow-none"
              >
                <div
                  className="bg-info text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold shadow-sm"
                  style={{ width: '38px', height: '38px', minWidth: '38px' }}
                >
                  {iniciales}
                </div>
                <span
                  className="fw-semibold small text-dark d-none d-sm-inline text-truncate"
                  style={{ maxWidth: '240px' }}
                >
                  {nombreUsuario}
                </span>
              </Dropdown.Toggle>

              <Dropdown.Menu className="shadow border-0" style={{ minWidth: '250px' }}>
                <div className="px-3 py-2">
                  <div className="fw-bold small text-dark text-truncate">{nombreUsuario}</div>
                  {rolUsuario === 'admin' && (
                    <Badge bg="warning" text="dark" className="mt-1">
                      Administrador
                    </Badge>
                  )}
                  <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                    <i className="bi bi-clock-history me-1"></i>
                    Últ. conexión: {ultimaConexion || 'Cargando...'}
                  </div>
                </div>
                <Dropdown.Divider />
                <Dropdown.Item onClick={onCerrarSesion} className="text-danger fw-semibold">
                  <i className="bi bi-box-arrow-left me-2"></i> Cerrar Sesión
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
