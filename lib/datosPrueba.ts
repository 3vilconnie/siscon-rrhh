// lib/datosPrueba.ts
// Un "trabajador ficticio" fijo, usado para generar un documento de prueba
// antes de activar una plantilla nueva (panel de Admin → Plantillas).
// Reutiliza exactamente los mismos *builders* que arman los datos reales
// (construirDatosContrato, etc.), así la vista previa pasa por el mismo
// camino que un documento real — solo con datos inventados.

import { Trabajador, Contrato } from '@/types';
import { construirDatosContrato, PROGRAMAS_CONTRATO } from '@/lib/contrato';
import { construirDatosFiniquito } from '@/lib/finiquito';
import { construirDatosHoras } from '@/lib/horasCompensatorias';
import { construirDatosRecepcion } from '@/lib/recepcion';
import { construirDatosDocumento, NOTIFICACION_DEFAULTS } from '@/lib/plantillas';

const HOY = new Date().toISOString().split('T')[0];
const PROGRAMA_ID = PROGRAMAS_CONTRATO[0].id;

const IDENTIDAD = {
  nombres: 'JUAN ANDRÉS',
  primerApellido: 'PRUEBA',
  segundoApellido: 'DOCUMENTO',
  rut: 11111111,
  dv: '1',
  genero: 'M' as const,
};

const PERSONALES = {
  nacionalidad: 'Chilena',
  estadoCivil: 'Soltero',
  lugarNac: 'Arica',
  fechaNac: '1990-01-15',
  domicilio: 'Calle de Prueba 123',
  comuna: 'Arica',
  prevision: 'AFP Uno',
  salud: 'FONASA',
};

const CONTRATO_DATOS = {
  jornada: 44,
  sueldo: 700000,
  fechaInicio: '2026-01-01',
  fechaTermino: '2026-12-31',
  labores: 'Labores de prueba',
  lugarTrabajo: 'Arica',
  dependenciaDir: 'la jefatura directa',
  bonoMovilizacion: 30000,
  bonoColacion: 30000,
};

/** Trabajador y contrato ficticios, con la forma que ya usan el resto de las vistas. */
export const TRABAJADOR_PRUEBA: Trabajador = {
  rut: IDENTIDAD.rut,
  dv: IDENTIDAD.dv,
  nombres: IDENTIDAD.nombres,
  primer_apellido: IDENTIDAD.primerApellido,
  segundo_apellido: IDENTIDAD.segundoApellido,
  genero: IDENTIDAD.genero,
  nacionalidad: PERSONALES.nacionalidad,
  estado_civil: PERSONALES.estadoCivil,
  fecha_nac: PERSONALES.fechaNac,
  lugar_nac: PERSONALES.lugarNac,
  domicilio: PERSONALES.domicilio,
  comuna: PERSONALES.comuna,
  prevision: PERSONALES.prevision,
  salud: PERSONALES.salud,
};

export const CONTRATO_PRUEBA: Contrato = {
  id: '00000000-0000-0000-0000-000000000000',
  trabajador_rut: IDENTIDAD.rut,
  jornada: CONTRATO_DATOS.jornada,
  sueldo_base: CONTRATO_DATOS.sueldo,
  fecha_inicio: CONTRATO_DATOS.fechaInicio,
  fecha_termino: CONTRATO_DATOS.fechaTermino,
  labores: CONTRATO_DATOS.labores,
  lugar_trabajo: CONTRATO_DATOS.lugarTrabajo,
  dependencia_dir: CONTRATO_DATOS.dependenciaDir,
  programa: PROGRAMA_ID,
  bono_movilizacion: CONTRATO_DATOS.bonoMovilizacion,
  bono_colacion: CONTRATO_DATOS.bonoColacion,
};

/** Devuelve los datos de prueba para un archivo de plantilla, listos para carbone.render(). */
export function datosPruebaPara(archivo: string): unknown {
  switch (archivo) {
    case 'contrato-trabajo.docx':
      return construirDatosContrato(
        {
          nombres: IDENTIDAD.nombres,
          primer_apellido: IDENTIDAD.primerApellido,
          segundo_apellido: IDENTIDAD.segundoApellido,
          rut: IDENTIDAD.rut,
          dv: IDENTIDAD.dv,
          genero: IDENTIDAD.genero,
        },
        {
          ciudad: 'Arica',
          fechaEmision: HOY,
          redactorIniciales: 'prb',
          programaId: PROGRAMA_ID,
          nacionalidad: PERSONALES.nacionalidad,
          estadoCivil: PERSONALES.estadoCivil,
          lugarNac: PERSONALES.lugarNac,
          fechaNac: PERSONALES.fechaNac,
          domicilio: PERSONALES.domicilio,
          comuna: PERSONALES.comuna,
          labores: CONTRATO_DATOS.labores,
          lugarTrabajo: CONTRATO_DATOS.lugarTrabajo,
          dependenciaDir: CONTRATO_DATOS.dependenciaDir,
          prevision: PERSONALES.prevision,
          salud: PERSONALES.salud,
          bonoMovilizacion: CONTRATO_DATOS.bonoMovilizacion,
          bonoColacion: CONTRATO_DATOS.bonoColacion,
          incluirBonos: true,
          inicioContrato: CONTRATO_DATOS.fechaInicio,
          terminoContrato: CONTRATO_DATOS.fechaTermino,
          sueldo: CONTRATO_DATOS.sueldo,
        },
      );

    case 'finiquito.docx':
      return construirDatosFiniquito(TRABAJADOR_PRUEBA, {
        ...CONTRATO_PRUEBA,
        fecha_termino: CONTRATO_DATOS.fechaTermino,
      }).datos;

    case 'horas-compensatorias.docx':
      return construirDatosHoras({
        nombreCompleto: `${IDENTIDAD.nombres} ${IDENTIDAD.primerApellido}`,
        rut: IDENTIDAD.rut,
        dv: IDENTIDAD.dv,
        ano: new Date().getFullYear(),
        tope: 44,
        consumidas: 12,
        disponibles: 32,
        detalles: [
          { fecha: '2026-03-10', horas_solicitadas: 4 },
          { fecha: '2026-05-02', horas_solicitadas: 8 },
        ],
      });

    case 'recepcion-documentos.docx':
      return construirDatosRecepcion({
        tipos: ['Contrato'],
        fechaRecepcion: HOY,
        descripcion: 'Documento de prueba',
        detalles: [
          {
            id: 1,
            fechaEmision: HOY,
            cabecera: PROGRAMA_ID,
            nombre: IDENTIDAD.nombres,
            apellidoP: IDENTIDAD.primerApellido,
            apellidoM: IDENTIDAD.segundoApellido,
            genero: IDENTIDAD.genero,
            rut: String(IDENTIDAD.rut),
            dv: IDENTIDAD.dv,
          },
        ],
        entrega: 'Departamento de Prueba',
        recibe: 'Recursos Humanos',
      });

    case 'certificado-antiguedad.docx':
      return construirDatosDocumento(TRABAJADOR_PRUEBA, CONTRATO_PRUEBA);

    case 'notificacion-fin-contrato.docx':
      return construirDatosDocumento(TRABAJADOR_PRUEBA, CONTRATO_PRUEBA, {
        notificacion: {
          ...NOTIFICACION_DEFAULTS,
          numero: '0000',
          fecha_notificacion: HOY,
        },
      });

    default:
      throw new Error(`No hay datos de prueba definidos para "${archivo}".`);
  }
}
