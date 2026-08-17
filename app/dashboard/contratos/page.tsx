'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { registrarAuditoria, ACCIONES } from '@/lib/auditoria';
import toast from 'react-hot-toast';
import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Badge,
  ListGroup,
  ButtonGroup,
} from 'react-bootstrap';
import { Trabajador, Contrato, PlantillaContrato } from '@/types';
import { useDebounce } from '@/lib/hooks/useDebounce';
import { formatearRutFiniquito } from '@/lib/finiquito';
import {
  PROGRAMAS_CONTRATO,
  DIRECTOR_CONTRATO_DEFAULT,
  CAMPOS_CONTRATO,
  ESTADOS_CIVILES,
  AFP_OPCIONES,
  SALUD_OPCIONES,
  estadoCivilLabel,
  estadoCivilIdDesdeLabel,
  construirDatosContrato,
  contratoSugerido,
  type DirectorContrato,
} from '@/lib/contrato';

type Modo = 'existente' | 'nuevo';

export default function ModuloContratos() {
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([]);
  const [loading, setLoading] = useState(true);
  const [modo, setModo] = useState<Modo>('existente');

  // Búsqueda / selección (modo existente)
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda, 300);
  const [trabajadorSel, setTrabajadorSel] = useState<Trabajador | null>(null);
  const [contratoSelId, setContratoSelId] = useState('');
  const [esAnexo, setEsAnexo] = useState(false);

  // Identidad del trabajador (editable; se prellena en modo existente).
  const [idNombres, setIdNombres] = useState('');
  const [idApellidoP, setIdApellidoP] = useState('');
  const [idApellidoM, setIdApellidoM] = useState('');
  const [idRut, setIdRut] = useState('');
  const [idDv, setIdDv] = useState('');
  const [idGenero, setIdGenero] = useState('');

  // Datos del contrato.
  const [inicio, setInicio] = useState('');
  const [termino, setTermino] = useState('');
  const [sueldo, setSueldo] = useState<number>(0);
  const [jornada, setJornada] = useState<number>(44);

  // Datos personales (no están en la BD).
  const [nacionalidad, setNacionalidad] = useState('Chilena');
  const [estadoCivilId, setEstadoCivilId] = useState('soltero');
  const [lugarNac, setLugarNac] = useState('');
  const [fechaNac, setFechaNac] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [comuna, setComuna] = useState('');

  // Detalle del contrato.
  const [labores, setLabores] = useState('');
  const [lugarTrabajo, setLugarTrabajo] = useState('');
  const [dependenciaDir, setDependenciaDir] = useState('');
  const [prevision, setPrevision] = useState('AFP Uno');
  const [salud, setSalud] = useState('FONASA');
  const [incluirBonos, setIncluirBonos] = useState(false);
  const [bonoMov, setBonoMov] = useState<number>(0);
  const [bonoCol, setBonoCol] = useState<number>(0);

  // Documento.
  const [programaId, setProgramaId] = useState(PROGRAMAS_CONTRATO[0].id);
  const [ciudad, setCiudad] = useState('Arica');
  const [redactor, setRedactor] = useState('crh');
  const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
  const [director, setDirector] = useState<DirectorContrato>({ ...DIRECTOR_CONTRATO_DEFAULT });
  const setDirectorCampo = (campo: keyof DirectorContrato, valor: string) =>
    setDirector((prev) => ({ ...prev, [campo]: valor }));

  const [guardar, setGuardar] = useState(false);
  const [generando, setGenerando] = useState<'pdf' | 'docx' | null>(null);

  // Plantillas de contrato (moldes reutilizables).
  const [plantillas, setPlantillas] = useState<PlantillaContrato[]>([]);
  const [plantillaSeleccionadaId, setPlantillaSeleccionadaId] = useState('');

  const cargarTrabajadores = async () => {
    const { data, error } = await supabase
      .from('trabajadores')
      .select(
        'rut, dv, nombres, primer_apellido, segundo_apellido, genero, nacionalidad, estado_civil, fecha_nac, lugar_nac, domicilio, comuna, prevision, salud, contratos(id, jornada, sueldo_base, fecha_inicio, fecha_termino, labores, lugar_trabajo, dependencia_dir, programa, bono_movilizacion, bono_colacion)',
      )
      .order('primer_apellido');
    if (error) {
      toast.error('Error al cargar los trabajadores.');
      console.error(error);
    }
    setTrabajadores((data as Trabajador[]) ?? []);
  };

  const cargarPlantillas = async () => {
    const { data, error } = await supabase
      .from('plantillas_contrato')
      .select('*')
      .order('nombre');
    if (error) {
      console.error(error);
      return;
    }
    setPlantillas((data as PlantillaContrato[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([cargarTrabajadores(), cargarPlantillas()]);
      setLoading(false);
    })();
  }, []);

  const aplicarPlantilla = (id: string) => {
    setPlantillaSeleccionadaId(id);
    const p = plantillas.find((x) => x.id === id);
    if (!p) return;
    if (PROGRAMAS_CONTRATO.some((prog) => prog.id === p.programa)) setProgramaId(p.programa);
    setLabores(p.labores ?? '');
    setLugarTrabajo(p.lugar_trabajo ?? '');
    setDependenciaDir(p.dependencia_dir ?? '');
    setJornada(p.jornada ?? 44);
    setIncluirBonos(p.incluir_bonos);
    setBonoMov(p.bono_movilizacion);
    setBonoCol(p.bono_colacion);
    setCiudad(p.ciudad ?? 'Arica');
    setRedactor(p.iniciales_redactor ?? 'crh');
    if (!sueldo) setSueldo(p.sueldo_sugerido);
  };

  const resultados = useMemo(() => {
    const q = busquedaDebounced.trim().toLowerCase();
    if (!q) return [];
    return trabajadores
      .filter((t) => {
        const nombre =
          `${t.nombres} ${t.primer_apellido} ${t.segundo_apellido ?? ''}`.toLowerCase();
        return nombre.includes(q) || t.rut.toString().includes(q.replace(/\./g, ''));
      })
      .slice(0, 8);
  }, [busquedaDebounced, trabajadores]);

  const aplicarContrato = (c: Contrato | null, t?: Trabajador | null) => {
    setInicio(c?.fecha_inicio ?? '');
    setTermino(c?.fecha_termino ?? '');
    setSueldo(c?.sueldo_base ?? 0);
    setJornada(c?.jornada ?? 44);
    // Datos de la plantilla guardados en el trabajador (si existen).
    setNacionalidad(t?.nacionalidad ?? 'Chilena');
    setEstadoCivilId(estadoCivilIdDesdeLabel(t?.estado_civil));
    setLugarNac(t?.lugar_nac ?? '');
    setFechaNac(t?.fecha_nac ?? '');
    setDomicilio(t?.domicilio ?? '');
    setComuna(t?.comuna ?? '');
    setLabores(c?.labores ?? '');
    setLugarTrabajo(c?.lugar_trabajo ?? '');
    setDependenciaDir(c?.dependencia_dir ?? '');
    if (c?.programa && PROGRAMAS_CONTRATO.some((p) => p.id === c.programa)) {
      setProgramaId(c.programa);
    }
    setPrevision(t?.prevision ?? 'AFP Uno');
    setSalud(t?.salud ?? 'FONASA');
    const mov = c?.bono_movilizacion ?? 0;
    const col = c?.bono_colacion ?? 0;
    setBonoMov(mov);
    setBonoCol(col);
    setIncluirBonos(mov + col > 0);
  };

  const seleccionarTrabajador = (t: Trabajador) => {
    setTrabajadorSel(t);
    setBusqueda('');
    setIdNombres(t.nombres);
    setIdApellidoP(t.primer_apellido);
    setIdApellidoM(t.segundo_apellido ?? '');
    setIdRut(t.rut.toString());
    setIdDv(t.dv);
    setIdGenero(t.genero === 'M' || t.genero === 'F' ? t.genero : '');
    const c = contratoSugerido(t);
    setContratoSelId(c?.id ?? '');
    aplicarContrato(c, t);
  };

  const limpiarIdentidad = () => {
    setTrabajadorSel(null);
    setContratoSelId('');
    setEsAnexo(false);
    setIdNombres('');
    setIdApellidoP('');
    setIdApellidoM('');
    setIdRut('');
    setIdDv('');
    setIdGenero('');
    setInicio('');
    setTermino('');
    setSueldo(0);
  };

  const cambiarModo = (m: Modo) => {
    setModo(m);
    limpiarIdentidad();
    setGuardar(false);
  };

  const cambiarContrato = (id: string) => {
    setContratoSelId(id);
    aplicarContrato(trabajadorSel?.contratos?.find((c) => c.id === id) ?? null, trabajadorSel);
  };

  const rutNumero = parseInt(idRut.replace(/\D/g, '')) || 0;
  const identidadValida =
    !!idNombres.trim() && !!idApellidoP.trim() && rutNumero > 0 && !!idDv.trim();

  const datos = useMemo(() => {
    if (!identidadValida) return null;
    return construirDatosContrato(
      {
        nombres: idNombres.trim(),
        primer_apellido: idApellidoP.trim(),
        segundo_apellido: idApellidoM.trim() || null,
        rut: rutNumero,
        dv: idDv.trim().toUpperCase(),
        genero: idGenero || undefined,
      },
      {
        ciudad,
        fechaEmision,
        redactorIniciales: redactor,
        programaId,
        nacionalidad,
        estadoCivil: estadoCivilLabel(estadoCivilId, idGenero || undefined),
        lugarNac,
        fechaNac,
        domicilio,
        comuna,
        labores,
        lugarTrabajo,
        dependenciaDir,
        prevision,
        salud,
        bonoMovilizacion: incluirBonos ? bonoMov : 0,
        bonoColacion: incluirBonos ? bonoCol : 0,
        incluirBonos,
        director,
        inicioContrato: inicio,
        terminoContrato: termino,
        sueldo,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    identidadValida,
    idNombres,
    idApellidoP,
    idApellidoM,
    idRut,
    idDv,
    idGenero,
    ciudad,
    fechaEmision,
    redactor,
    programaId,
    nacionalidad,
    estadoCivilId,
    lugarNac,
    fechaNac,
    domicilio,
    comuna,
    labores,
    lugarTrabajo,
    dependenciaDir,
    prevision,
    salud,
    incluirBonos,
    bonoMov,
    bonoCol,
    director,
    inicio,
    termino,
    sueldo,
  ]);

  const puedeGenerar = !!datos && !!inicio && !!termino && sueldo > 0;

  /** Guarda el trabajador (si es nuevo) y/o el contrato en la base. */
  const guardarEnBase = async (): Promise<boolean> => {
    // Alta de trabajador nuevo.
    if (modo === 'nuevo' && !trabajadores.some((t) => t.rut === rutNumero)) {
      const { error: errT } = await supabase.from('trabajadores').insert({
        rut: rutNumero,
        dv: idDv.trim().toUpperCase(),
        nombres: idNombres.trim().toUpperCase(),
        primer_apellido: idApellidoP.trim().toUpperCase(),
        segundo_apellido: idApellidoM.trim() ? idApellidoM.trim().toUpperCase() : null,
        genero: idGenero || null,
        nacionalidad: nacionalidad || null,
        estado_civil: estadoCivilLabel(estadoCivilId, idGenero || undefined),
        lugar_nac: lugarNac || null,
        fecha_nac: fechaNac || null,
        domicilio: domicilio || null,
        comuna: comuna || null,
        prevision: prevision || null,
        salud: salud || null,
      });
      if (errT) {
        toast.error(`No se pudo registrar al trabajador: ${errT.message}`);
        return false;
      }
      await registrarAuditoria(
        ACCIONES.CREAR_TRABAJADOR,
        `RUT ${rutNumero}-${idDv.toUpperCase()}: ${idNombres.trim()} ${idApellidoP.trim()} ${idApellidoM.trim()}`.trim(),
      );
    } else if (modo === 'existente' && trabajadorSel) {
      await supabase
        .from('trabajadores')
        .update({
          genero: idGenero || null,
          nacionalidad: nacionalidad || null,
          estado_civil: estadoCivilLabel(estadoCivilId, idGenero || undefined),
          lugar_nac: lugarNac || null,
          fecha_nac: fechaNac || null,
          domicilio: domicilio || null,
          comuna: comuna || null,
          prevision: prevision || null,
          salud: salud || null,
        })
        .eq('rut', rutNumero);
    }

    // Alta del contrato (con todos los datos de la plantilla).
    const { error: errC } = await supabase.from('contratos').insert({
      trabajador_rut: rutNumero,
      jornada: jornada || 44,
      sueldo_base: sueldo,
      fecha_inicio: inicio,
      fecha_termino: termino || null,
      labores: labores || null,
      lugar_trabajo: lugarTrabajo || null,
      dependencia_dir: dependenciaDir || null,
      programa: programaId || null,
      bono_movilizacion: incluirBonos ? bonoMov : 0,
      bono_colacion: incluirBonos ? bonoCol : 0,
      tipo: esAnexo ? 'anexo' : 'contrato',
      contrato_origen_id: esAnexo ? contratoSelId || null : null,
    });
    if (errC) {
      const msg = /exclusion/i.test(errC.message)
        ? 'El período se superpone con otro contrato ya registrado.'
        : errC.message;
      toast.error(`No se pudo guardar el contrato: ${msg}`);
      return false;
    }
    await registrarAuditoria(
      ACCIONES.CREAR_CONTRATO,
      `RUT ${rutNumero}: ${inicio} → ${termino || 'Indefinido'}, jornada ${jornada}h, sueldo $${sueldo}`,
    );
    await cargarTrabajadores();
    return true;
  };

  const generar = async (formato: 'pdf' | 'docx') => {
    if (!datos) return toast.error('Completa la identidad del trabajador.');
    if (!inicio || !termino) return toast.error('Indica el inicio y término del contrato.');
    if (sueldo <= 0) return toast.error('Indica el sueldo.');

    setGenerando(formato);
    const toastId = toast.loading(`Generando contrato ${formato.toUpperCase()}...`);
    try {
      if (guardar) {
        const ok = await guardarEnBase();
        if (!ok) {
          toast.dismiss(toastId);
          setGenerando(null);
          return;
        }
      }

      const res = await fetch('/api/contratos/generar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formato, datos }),
      });
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Error desconocido.' }));
        throw new Error(error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrato_${rutNumero}.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(
        guardar
          ? `Contrato generado y guardado en la base.`
          : `Contrato ${formato.toUpperCase()} generado.`,
        { id: toastId },
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el contrato.', {
        id: toastId,
        duration: 6000,
      });
    } finally {
      setGenerando(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center gap-2 text-secondary">
        <Spinner animation="border" size="sm" role="status" /> Cargando trabajadores...
      </div>
    );
  }

  const label = (t: string) => (
    <Form.Label className="small fw-bold text-secondary">{t}</Form.Label>
  );

  return (
    <div className="container-fluid" style={{ maxWidth: '1150px' }}>
      <div className="mb-4 d-flex justify-content-between align-items-start gap-3">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-file-earmark-text text-primary me-2"></i>
            Generación de Contratos
          </h3>
          <p className="text-muted small m-0">
            Genera el Contrato de Trabajo de Plazo Fijo para un trabajador nuevo o existente.
            Opcionalmente puedes guardarlo en la base al generar.
          </p>
        </div>
        <Link href="/dashboard/contratos/masivo" className="btn btn-outline-primary shrink-0">
          <i className="bi bi-people-fill me-1"></i> Contratos masivos
        </Link>
      </div>

      <Row className="g-4">
        <Col lg={8}>
          {/* Paso 1: Trabajador */}
          <Card className="shadow-sm border-0 mb-3">
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-uppercase text-secondary small m-0">
                  <Badge bg="primary" className="me-2">
                    1
                  </Badge>
                  Trabajador
                </h6>
                <ButtonGroup size="sm">
                  <Button
                    variant={modo === 'existente' ? 'primary' : 'outline-primary'}
                    onClick={() => cambiarModo('existente')}
                  >
                    Existente
                  </Button>
                  <Button
                    variant={modo === 'nuevo' ? 'primary' : 'outline-primary'}
                    onClick={() => cambiarModo('nuevo')}
                  >
                    Nuevo
                  </Button>
                </ButtonGroup>
              </div>

              {/* Modo existente: búsqueda */}
              {modo === 'existente' && !trabajadorSel && (
                <>
                  <Form.Control
                    type="text"
                    placeholder="Buscar por RUT, nombre o apellidos..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    autoFocus
                  />
                  {resultados.length > 0 && (
                    <ListGroup className="mt-2 shadow-sm">
                      {resultados.map((t) => (
                        <ListGroup.Item
                          key={t.rut}
                          action
                          onClick={() => seleccionarTrabajador(t)}
                          className="d-flex justify-content-between align-items-center"
                        >
                          <span className="text-uppercase">
                            {t.nombres} {t.primer_apellido} {t.segundo_apellido ?? ''}
                          </span>
                          <span className="text-muted small font-monospace">
                            {formatearRutFiniquito(t.rut, t.dv)}
                          </span>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </>
              )}

              {modo === 'existente' && trabajadorSel && (
                <div className="d-flex justify-content-between align-items-center bg-light rounded p-3 mb-3">
                  <div>
                    <div className="fw-bold text-dark text-uppercase">
                      {idNombres} {idApellidoP} {idApellidoM}
                    </div>
                    <div className="text-muted small font-monospace">
                      {formatearRutFiniquito(rutNumero, idDv)}
                    </div>
                  </div>
                  <Button variant="outline-secondary" size="sm" onClick={limpiarIdentidad}>
                    Cambiar
                  </Button>
                </div>
              )}

              {/* Identidad manual (modo nuevo) */}
              {modo === 'nuevo' && (
                <Row className="g-3 mb-3">
                  <Col xs={12} md={4}>
                    {label('Nombres')}
                    <Form.Control
                      value={idNombres}
                      onChange={(e) => setIdNombres(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={4}>
                    {label('Apellido paterno')}
                    <Form.Control
                      value={idApellidoP}
                      onChange={(e) => setIdApellidoP(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={4}>
                    {label('Apellido materno')}
                    <Form.Control
                      value={idApellidoM}
                      onChange={(e) => setIdApellidoM(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={3}>
                    {label('RUT (sin DV)')}
                    <Form.Control
                      value={idRut}
                      onChange={(e) => setIdRut(e.target.value)}
                      placeholder="15001472"
                    />
                  </Col>
                  <Col xs={3} md={2}>
                    {label('DV')}
                    <Form.Control
                      value={idDv}
                      maxLength={1}
                      onChange={(e) => setIdDv(e.target.value)}
                    />
                  </Col>
                </Row>
              )}

              {/* Género + contrato (ambos modos) */}
              {(trabajadorSel || modo === 'nuevo') && (
                <Row className="g-3">
                  {modo === 'existente' && (trabajadorSel?.contratos ?? []).length > 0 && (
                    <Col xs={12}>
                      {label('Contrato de la base (para prellenar fechas y sueldo)')}
                      <Form.Select
                        value={contratoSelId}
                        onChange={(e) => cambiarContrato(e.target.value)}
                      >
                        {[...(trabajadorSel?.contratos ?? [])]
                          .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {new Date(c.fecha_inicio).toLocaleDateString('es-CL')} →{' '}
                              {c.fecha_termino
                                ? new Date(c.fecha_termino).toLocaleDateString('es-CL')
                                : 'Indefinido'}
                              {c.sueldo_base ? ` · $${c.sueldo_base.toLocaleString('es-CL')}` : ''}
                            </option>
                          ))}
                      </Form.Select>
                    </Col>
                  )}
                  {modo === 'existente' && (trabajadorSel?.contratos ?? []).length > 0 && (
                    <Col xs={12}>
                      <Form.Check
                        type="switch"
                        id="es-anexo-individual"
                        checked={esAnexo}
                        disabled={!contratoSelId}
                        onChange={(e) => setEsAnexo(e.target.checked)}
                        label="Este contrato es un Anexo de Ampliación del contrato seleccionado arriba"
                      />
                      {esAnexo && !contratoSelId && (
                        <div className="text-warning small mt-1">
                          <i className="bi bi-exclamation-triangle me-1"></i>
                          Selecciona el contrato que se está ampliando.
                        </div>
                      )}
                    </Col>
                  )}
                  <Col xs={6} md={3}>
                    {label('Género')}
                    <Form.Select value={idGenero} onChange={(e) => setIdGenero(e.target.value)}>
                      <option value="">— sin especificar —</option>
                      <option value="M">Masculino</option>
                      <option value="F">Femenino</option>
                    </Form.Select>
                  </Col>
                  <Col xs={6} md={3}>
                    {label('Inicio contrato')}
                    <Form.Control
                      type="date"
                      value={inicio}
                      onChange={(e) => setInicio(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={3}>
                    {label('Término contrato')}
                    <Form.Control
                      type="date"
                      value={termino}
                      onChange={(e) => setTermino(e.target.value)}
                    />
                  </Col>
                  <Col xs={6} md={3}>
                    {label('Sueldo bruto')}
                    <Form.Control
                      type="number"
                      min={0}
                      value={sueldo || ''}
                      onChange={(e) => setSueldo(Number(e.target.value) || 0)}
                    />
                  </Col>
                  {!idGenero && (
                    <Col xs={12}>
                      <div className="alert alert-warning py-2 small mb-0">
                        <i className="bi bi-exclamation-triangle me-1"></i>
                        Sin género, los textos saldrán como “el(la) trabajador(a)”. Selecciónalo
                        para un documento correcto.
                      </div>
                    </Col>
                  )}
                </Row>
              )}
            </Card.Body>
          </Card>

          {(trabajadorSel || (modo === 'nuevo' && identidadValida)) && (
            <>
              {/* Paso 2: Datos personales */}
              <Card className="shadow-sm border-0 mb-3">
                <Card.Body className="p-4">
                  <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                    <Badge bg="primary" className="me-2">
                      2
                    </Badge>
                    Datos personales
                  </h6>
                  <Row className="g-3">
                    <Col xs={6} md={4}>
                      {label('Nacionalidad')}
                      <Form.Control
                        value={nacionalidad}
                        onChange={(e) => setNacionalidad(e.target.value)}
                      />
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Estado civil')}
                      <Form.Select
                        value={estadoCivilId}
                        onChange={(e) => setEstadoCivilId(e.target.value)}
                      >
                        {ESTADOS_CIVILES.map((ec) => (
                          <option key={ec.id} value={ec.id}>
                            {estadoCivilLabel(ec.id, idGenero || undefined)}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Fecha de nacimiento')}
                      <Form.Control
                        type="date"
                        value={fechaNac}
                        onChange={(e) => setFechaNac(e.target.value)}
                      />
                    </Col>
                    <Col xs={12} md={6}>
                      {label('Lugar de nacimiento')}
                      <Form.Control
                        value={lugarNac}
                        onChange={(e) => setLugarNac(e.target.value)}
                      />
                    </Col>
                    <Col xs={8} md={4}>
                      {label('Domicilio')}
                      <Form.Control
                        value={domicilio}
                        onChange={(e) => setDomicilio(e.target.value)}
                      />
                    </Col>
                    <Col xs={4} md={2}>
                      {label('Comuna')}
                      <Form.Control value={comuna} onChange={(e) => setComuna(e.target.value)} />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Paso 3: Detalle del contrato */}
              <Card className="shadow-sm border-0 mb-3">
                <Card.Body className="p-4">
                  <h6 className="fw-bold text-uppercase text-secondary small mb-3">
                    <Badge bg="primary" className="me-2">
                      3
                    </Badge>
                    Detalle del contrato
                  </h6>

                  <div className="bg-light border border-primary-subtle rounded p-3 mb-3">
                    {label('Cargar desde plantilla')}
                    <Form.Select
                      value={plantillaSeleccionadaId}
                      onChange={(e) => aplicarPlantilla(e.target.value)}
                    >
                      <option value="">— Rellenar manualmente —</option>
                      {plantillas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </Form.Select>
                    {plantillas.length === 0 && (
                      <Form.Text className="text-muted">
                        Aún no tienes plantillas guardadas.{' '}
                        <Link href="/dashboard/contratos/plantillas">Crea una aquí</Link>.
                      </Form.Text>
                    )}
                  </div>

                  <Row className="g-3">
                    <Col xs={12}>
                      {label('Programa / Proyecto (cabecera)')}
                      <Form.Select
                        value={programaId}
                        onChange={(e) => setProgramaId(e.target.value)}
                      >
                        {PROGRAMAS_CONTRATO.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.etiqueta}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={12} md={6}>
                      {label('Labores')}
                      <Form.Control
                        value={labores}
                        onChange={(e) => setLabores(e.target.value)}
                        placeholder="Ej: Jornal"
                      />
                    </Col>
                    <Col xs={12} md={6}>
                      {label('Lugar de trabajo (comuna)')}
                      <Form.Control
                        value={lugarTrabajo}
                        onChange={(e) => setLugarTrabajo(e.target.value)}
                      />
                    </Col>
                    <Col xs={12}>
                      {label('Dependencia directa')}
                      <Form.Control
                        value={dependenciaDir}
                        onChange={(e) => setDependenciaDir(e.target.value)}
                        placeholder="Ej: la coordinadora del proyecto ..."
                      />
                    </Col>
                    <Col xs={6} md={2}>
                      {label('Jornada (h)')}
                      <Form.Control
                        type="number"
                        min={1}
                        value={jornada || ''}
                        onChange={(e) => setJornada(Number(e.target.value) || 44)}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      {label('Previsión')}
                      <Form.Select value={prevision} onChange={(e) => setPrevision(e.target.value)}>
                        {AFP_OPCIONES.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={6} md={3}>
                      {label('Salud')}
                      <Form.Select value={salud} onChange={(e) => setSalud(e.target.value)}>
                        {SALUD_OPCIONES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </Form.Select>
                    </Col>
                    <Col xs={12}>
                      <Form.Check
                        type="checkbox"
                        id="incluir-bonos"
                        checked={incluirBonos}
                        onChange={(e) => setIncluirBonos(e.target.checked)}
                        label="Incluir bonos de movilización y colación (cláusula NOVENO)"
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      {label('Bono movilización')}
                      <Form.Control
                        type="number"
                        min={0}
                        disabled={!incluirBonos}
                        value={bonoMov || ''}
                        onChange={(e) => setBonoMov(Number(e.target.value) || 0)}
                      />
                    </Col>
                    <Col xs={6} md={3}>
                      {label('Bono colación')}
                      <Form.Control
                        type="number"
                        min={0}
                        disabled={!incluirBonos}
                        value={bonoCol || ''}
                        onChange={(e) => setBonoCol(Number(e.target.value) || 0)}
                      />
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Ciudad')}
                      <Form.Control value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Fecha emisión')}
                      <Form.Control
                        type="date"
                        value={fechaEmision}
                        onChange={(e) => setFechaEmision(e.target.value)}
                      />
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Iniciales redactor')}
                      <Form.Control
                        value={redactor}
                        onChange={(e) => setRedactor(e.target.value)}
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Paso 4: Firmante */}
              <Card className="shadow-sm border-0 mb-3">
                <Card.Body className="p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold text-uppercase text-secondary small m-0">
                      <Badge bg="primary" className="me-2">
                        4
                      </Badge>
                      Director (firmante)
                    </h6>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-decoration-none p-0 small"
                      onClick={() => setDirector({ ...DIRECTOR_CONTRATO_DEFAULT })}
                    >
                      <i className="bi bi-arrow-counterclockwise me-1"></i>Predeterminado
                    </Button>
                  </div>
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      {label('Nombre')}
                      <Form.Control
                        value={director.nombre}
                        onChange={(e) => setDirectorCampo('nombre', e.target.value)}
                      />
                    </Col>
                    <Col xs={6} md={6}>
                      {label('RUT')}
                      <Form.Control
                        value={director.rut}
                        onChange={(e) => setDirectorCampo('rut', e.target.value)}
                      />
                    </Col>
                    <Col xs={6} md={4}>
                      {label('Cargo')}
                      <Form.Control
                        value={director.cargo}
                        onChange={(e) => setDirectorCampo('cargo', e.target.value)}
                      />
                    </Col>
                    <Col xs={12} md={6}>
                      {label('Profesión')}
                      <Form.Control
                        value={director.profesion}
                        onChange={(e) => setDirectorCampo('profesion', e.target.value)}
                      />
                    </Col>
                  </Row>
                </Card.Body>
              </Card>

              {/* Acciones */}
              <Card className="shadow-sm border-0">
                <Card.Body className="p-4">
                  <Form.Check
                    type="checkbox"
                    id="guardar-en-base"
                    className="mb-3"
                    checked={guardar}
                    onChange={(e) => setGuardar(e.target.checked)}
                    label={
                      modo === 'nuevo'
                        ? 'Registrar al trabajador y su contrato en la base al generar'
                        : 'Guardar este período como un contrato nuevo en la base'
                    }
                  />
                  <div className="d-flex gap-2 justify-content-end">
                    <Button
                      variant="outline-primary"
                      disabled={!puedeGenerar || generando !== null}
                      onClick={() => generar('docx')}
                    >
                      <i className="bi bi-file-earmark-word me-1"></i>
                      {generando === 'docx' ? 'Generando...' : 'Descargar Word'}
                    </Button>
                    <Button
                      variant="primary"
                      disabled={!puedeGenerar || generando !== null}
                      onClick={() => generar('pdf')}
                    >
                      <i className="bi bi-file-earmark-pdf me-1"></i>
                      {generando === 'pdf' ? 'Generando...' : 'Generar PDF'}
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </>
          )}
        </Col>

        {/* Columna derecha: marcadores */}
        <Col lg={4}>
          <Card className="shadow-sm border-0" style={{ position: 'sticky', top: '1rem' }}>
            <Card.Header className="bg-light fw-bold small py-2 text-secondary">
              <i className="bi bi-braces me-1"></i> Marcadores para tu plantilla Word
            </Card.Header>
            <Card.Body className="p-3" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <p className="text-muted" style={{ fontSize: '0.72rem' }}>
                La plantilla <code>plantillas/contrato-trabajo.docx</code> usa estos marcadores. Los
                textos por género se resuelven automáticamente.
              </p>
              {CAMPOS_CONTRATO.map((c) => (
                <div key={c.marcador} className="mb-2">
                  <code className="d-block text-primary" style={{ fontSize: '0.72rem' }}>
                    {c.marcador}
                  </code>
                  <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                    {c.descripcion}
                  </span>
                </div>
              ))}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
