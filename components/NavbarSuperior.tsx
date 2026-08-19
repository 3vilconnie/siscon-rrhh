'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Navbar,
  Nav,
  NavDropdown,
  Button,
  Badge,
  Card,
  Dropdown,
  Container,
  Modal,
  Form,
  Alert,
  InputGroup,
} from 'react-bootstrap';
import { Trabajador, AlertaNotificacion } from '@/types';
import { evaluarAlertaContinuidad } from '@/lib/utils/calculoAlertas';
import { formatearRutFiniquito } from '@/lib/finiquito';

interface NavbarSuperiorProps {
  nombreUsuario: string;
  emailUsuario: string;
  ultimaConexion: string;
  rolUsuario: string;
  /** RUT del trabajador asociado. Solo lectura: lo asigna un administrador. */
  rutAsociado: number | null;
  onCerrarSesion: (e: React.MouseEvent) => void;
  onPerfilActualizado: () => void | Promise<void>;
}

interface EnlaceNav {
  href: string;
  icon: string;
  label: string;
}

/** Menú desplegable de la barra que se abre al pasar el cursor (hover). */
function NavHoverDropdown({
  id,
  icon,
  label,
  items,
  checkIsActive,
}: {
  id: string;
  icon: string;
  label: string;
  items: EnlaceNav[];
  checkIsActive: (path: string) => boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const activo = items.some((e) => checkIsActive(e.href));
  return (
    <div onMouseEnter={() => setAbierto(true)} onMouseLeave={() => setAbierto(false)}>
      <NavDropdown
        show={abierto}
        onToggle={(next) => setAbierto(next)}
        id={id}
        title={
          <span className="d-inline-flex align-items-center gap-2">
            <i className={`bi ${icon}`}></i> {label}
          </span>
        }
        className={`px-2 rounded ${activo ? 'fw-bold text-primary bg-primary bg-opacity-10' : 'text-secondary'}`}
      >
        {items.map((e) => (
          <NavDropdown.Item
            key={e.href}
            as={Link}
            href={e.href}
            active={checkIsActive(e.href)}
            className="d-flex align-items-center gap-2"
            onClick={() => setAbierto(false)}
          >
            <i className={`bi ${e.icon}`}></i> {e.label}
          </NavDropdown.Item>
        ))}
      </NavDropdown>
    </div>
  );
}

export default function NavbarSuperior({
  nombreUsuario,
  emailUsuario,
  ultimaConexion,
  rolUsuario,
  rutAsociado,
  onCerrarSesion,
  onPerfilActualizado,
}: NavbarSuperiorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [alertas, setAlertas] = useState<AlertaNotificacion[]>([]);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const contenedorRef = useRef<HTMLDivElement>(null);

  // --- MI PERFIL ---
  const [modalPerfil, setModalPerfil] = useState(false);
  const [trabajadorAsociado, setTrabajadorAsociado] = useState<{
    nombre: string;
    rutFormateado: string;
  } | null>(null);
  const [formPerfil, setFormPerfil] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmar: '',
  });
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [guardandoPerfil, setGuardandoPerfil] = useState(false);
  const [errorPerfil, setErrorPerfil] = useState('');
  const [okPerfil, setOkPerfil] = useState('');

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

  // Nombre del trabajador vinculado, para mostrarlo junto al RUT en el dropdown.
  useEffect(() => {
    if (!rutAsociado) {
      setTrabajadorAsociado(null);
      return;
    }
    let vigente = true;
    (async () => {
      const { data } = await supabase
        .from('trabajadores')
        .select('rut, dv, nombres, primer_apellido, segundo_apellido')
        .eq('rut', rutAsociado)
        .maybeSingle();
      if (!vigente) return;
      if (data) {
        const t = data as Trabajador;
        setTrabajadorAsociado({
          nombre: `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`
            .trim()
            .toUpperCase(),
          rutFormateado: formatearRutFiniquito(t.rut, t.dv),
        });
      } else {
        setTrabajadorAsociado(null);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [rutAsociado]);

  const abrirModalPerfil = () => {
    setFormPerfil({ fullName: nombreUsuario, email: emailUsuario, password: '', confirmar: '' });
    setErrorPerfil('');
    setOkPerfil('');
    setMostrarPassword(false);
    setModalPerfil(true);
  };

  const handleGuardarPerfil = async () => {
    setErrorPerfil('');
    setOkPerfil('');

    if (formPerfil.password) {
      if (formPerfil.password.length < 8) {
        setErrorPerfil('La contraseña debe tener al menos 8 caracteres.');
        return;
      }
      if (formPerfil.password !== formPerfil.confirmar) {
        setErrorPerfil('Las contraseñas no coinciden.');
        return;
      }
    }

    setGuardandoPerfil(true);
    try {
      // Solo se envía lo que realmente cambió. El RUT no se incluye jamás:
      // vive en app_metadata y solo lo puede modificar un administrador.
      const cambios: {
        email?: string;
        password?: string;
        data?: { full_name: string };
      } = {};

      if (formPerfil.fullName.trim() && formPerfil.fullName.trim() !== nombreUsuario) {
        cambios.data = { full_name: formPerfil.fullName.trim() };
      }
      if (formPerfil.email.trim() && formPerfil.email.trim() !== emailUsuario) {
        cambios.email = formPerfil.email.trim();
      }
      if (formPerfil.password) {
        cambios.password = formPerfil.password;
      }

      if (Object.keys(cambios).length === 0) {
        setErrorPerfil('No hay cambios que guardar.');
        setGuardandoPerfil(false);
        return;
      }

      const { error } = await supabase.auth.updateUser(cambios);
      if (error) throw error;

      await onPerfilActualizado();

      setOkPerfil(
        cambios.email
          ? 'Datos guardados. Para confirmar el cambio de correo, revisa el enlace enviado a tu nueva dirección.'
          : 'Datos actualizados correctamente.',
      );
      setFormPerfil((prev) => ({ ...prev, password: '', confirmar: '' }));
    } catch (error) {
      setErrorPerfil(
        error instanceof Error ? error.message : 'No se pudieron guardar los cambios.',
      );
    } finally {
      setGuardandoPerfil(false);
    }
  };

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

  // Enlaces agrupados en desplegables (se abren al pasar el cursor).
  const enlacesTrabajadores = [
    { href: '/dashboard/trabajadores', icon: 'bi-people', label: 'Ver trabajadores' },
    { href: '/dashboard/formulario', icon: 'bi-person-plus', label: 'Registrar' },
    { href: '/dashboard/carga-masiva', icon: 'bi-cloud-arrow-up', label: 'Carga Masiva' },
  ];
  const enlacesDocumentos = [
    { href: '/dashboard/documentos', icon: 'bi-file-earmark-word', label: 'Notificaciones' },
    { href: '/dashboard/recepcion', icon: 'bi-book', label: 'Recepción' },
    { href: '/dashboard/finiquito', icon: 'bi-cash-coin', label: 'Finiquito' },
    { href: '/dashboard/contratos', icon: 'bi-file-earmark-text', label: 'Contratos' },
    {
      href: '/dashboard/contratos/plantillas',
      icon: 'bi-file-earmark-ruled',
      label: 'Plantillas de Contrato',
    },
  ];
  const enlacesSecundarios = [
    { href: '/dashboard/horas-compensatorias', icon: 'bi-clock-history', label: 'Horas Comp.' },
  ];

  // El enlace "activo" es el de href más específico (más largo) que hace match con la
  // ruta actual — evita que una ruta anidada (ej. /dashboard/contratos/plantillas)
  // resalte a la vez su propio enlace y el de su ruta padre (/dashboard/contratos).
  const todosLosEnlaces = [
    ...enlacesTrabajadores,
    ...enlacesDocumentos,
    ...enlacesSecundarios,
    { href: '/dashboard/admin', icon: 'bi-gear-fill', label: 'Admin' },
  ];
  const enlaceActivo = todosLosEnlaces
    .filter((e) => pathname === e.href || pathname.startsWith(`${e.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const checkIsActive = (path: string) => path === enlaceActivo;

  const iniciales = nombreUsuario.substring(0, 2).toUpperCase();

  return (
    <>
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
              <NavHoverDropdown
                id="dropdown-trabajadores"
                icon="bi-people"
                label="Trabajadores"
                items={enlacesTrabajadores}
                checkIsActive={checkIsActive}
              />
              <NavHoverDropdown
                id="dropdown-documentos"
                icon="bi-folder2-open"
                label="Documentos"
                items={enlacesDocumentos}
                checkIsActive={checkIsActive}
              />

              {enlacesSecundarios.map((e) => (
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
                    <div className="text-muted text-truncate" style={{ fontSize: '11px' }}>
                      {emailUsuario}
                    </div>
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

                  {/* Ficha de trabajador vinculada: solo lectura, la asigna un administrador. */}
                  <Dropdown.Divider />
                  <div className="px-3 py-2">
                    <div
                      className="text-uppercase text-muted fw-semibold mb-1"
                      style={{ fontSize: '10px', letterSpacing: '0.03em' }}
                    >
                      Ficha de trabajador
                    </div>
                    {rutAsociado ? (
                      <>
                        <div className="small fw-semibold text-dark text-truncate">
                          {trabajadorAsociado?.nombre ?? 'Trabajador no encontrado'}
                        </div>
                        <div className="text-muted font-monospace" style={{ fontSize: '11px' }}>
                          {trabajadorAsociado?.rutFormateado ?? rutAsociado}
                        </div>
                      </>
                    ) : (
                      <div className="text-muted" style={{ fontSize: '11px' }}>
                        Sin ficha asociada. Solicítalo a un administrador.
                      </div>
                    )}
                  </div>

                  <Dropdown.Divider />
                  <Dropdown.Item onClick={abrirModalPerfil} className="fw-semibold">
                    <i className="bi bi-person-gear me-2"></i> Editar mis datos
                  </Dropdown.Item>
                  <Dropdown.Item onClick={onCerrarSesion} className="text-danger fw-semibold">
                    <i className="bi bi-box-arrow-left me-2"></i> Cerrar Sesión
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* --- MODAL: EDITAR MIS DATOS --- */}
      <Modal show={modalPerfil} onHide={() => setModalPerfil(false)} centered>
        <Modal.Header closeButton className="bg-primary text-white border-bottom-0">
          <Modal.Title className="fw-bold fs-5">
            <i className="bi bi-person-gear me-2"></i>Mis Datos
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {errorPerfil && (
            <Alert variant="danger" className="py-2 small">
              {errorPerfil}
            </Alert>
          )}
          {okPerfil && (
            <Alert variant="success" className="py-2 small">
              {okPerfil}
            </Alert>
          )}

          {/* El RUT se muestra pero no se edita: la asociación con la ficha de
            trabajador solo la puede cambiar un administrador. */}
          <div className="bg-light border rounded p-3 mb-3">
            <div className="small fw-bold text-secondary mb-1">Ficha de trabajador asociada</div>
            {rutAsociado ? (
              <div className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold text-dark small">
                  {trabajadorAsociado?.nombre ?? 'Trabajador no encontrado'}
                </span>
                <span className="font-monospace text-muted small">
                  {trabajadorAsociado?.rutFormateado ?? rutAsociado}
                </span>
              </div>
            ) : (
              <div className="text-muted small">Sin ficha asociada.</div>
            )}
            <div className="text-muted mt-2" style={{ fontSize: '0.72rem' }}>
              <i className="bi bi-lock-fill me-1"></i>
              Solo un administrador puede modificar esta asociación.
            </div>
          </div>

          <Form>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Nombre para mostrar</Form.Label>
              <Form.Control
                type="text"
                value={formPerfil.fullName}
                onChange={(e) => setFormPerfil({ ...formPerfil, fullName: e.target.value })}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Correo electrónico</Form.Label>
              <Form.Control
                type="email"
                value={formPerfil.email}
                onChange={(e) => setFormPerfil({ ...formPerfil, email: e.target.value })}
              />
              <Form.Text className="text-muted" style={{ fontSize: '0.72rem' }}>
                Si lo cambias, deberás confirmarlo desde un enlace enviado a la nueva dirección.
              </Form.Text>
            </Form.Group>

            <hr className="my-3" />

            <Form.Group className="mb-3">
              <Form.Label className="small fw-bold text-secondary">Nueva contraseña</Form.Label>
              <InputGroup>
                <Form.Control
                  type={mostrarPassword ? 'text' : 'password'}
                  placeholder="Déjala vacía para no cambiarla"
                  value={formPerfil.password}
                  onChange={(e) => setFormPerfil({ ...formPerfil, password: e.target.value })}
                />
                <Button
                  variant="outline-secondary"
                  type="button"
                  onClick={() => setMostrarPassword((v) => !v)}
                  aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  <i className={`bi ${mostrarPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                </Button>
              </InputGroup>
            </Form.Group>

            {formPerfil.password && (
              <Form.Group>
                <Form.Label className="small fw-bold text-secondary">
                  Confirmar nueva contraseña
                </Form.Label>
                <Form.Control
                  type={mostrarPassword ? 'text' : 'password'}
                  value={formPerfil.confirmar}
                  onChange={(e) => setFormPerfil({ ...formPerfil, confirmar: e.target.value })}
                />
              </Form.Group>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-0">
          <Button
            variant="outline-secondary"
            onClick={() => setModalPerfil(false)}
            className="fw-semibold"
            disabled={guardandoPerfil}
          >
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={handleGuardarPerfil}
            className="fw-semibold shadow-sm"
            disabled={guardandoPerfil}
          >
            {guardandoPerfil ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
