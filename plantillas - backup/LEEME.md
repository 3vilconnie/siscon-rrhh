# Plantillas Word (Carbone)

Esta carpeta contiene las plantillas `.docx` que el sistema rellena con datos de Supabase
usando [Carbone](https://carbone.io) y convierte a PDF.

## Cómo crear una plantilla

1. Abre Word y diseña el documento normalmente (logos, membrete, márgenes, tipografía).
2. Donde quieras insertar un dato, escribe el **marcador** correspondiente (ver tabla abajo).
   Es igual que la combinación de correspondencia, pero con la sintaxis `{d.campo}`.
3. Guarda el archivo como `.docx` **en esta carpeta**.
4. Regístralo en `lib/plantillas.ts` dentro del arreglo `PLANTILLAS` (id, nombre, archivo…).

> Los archivos definidos hoy en `lib/plantillas.ts` son:
> - `notificacion-fin-contrato.docx` — ✅ ya creado y funcional (basado en la plantilla de Word original).
> - `certificado-antiguedad.docx` — ✅ creado (ejemplo).
> - `certificado-vigencia.docx` — ⛔ pendiente: créalo en Word y déjalo aquí.
>
> Los .docx generados aquí llevan formato mínimo (sin logo). Ábrelos en Word para
> ajustar tipografía, membrete o el logo institucional; respeta los marcadores `{d....}`.

## Marcadores disponibles

| Marcador | Reemplaza por |
|---|---|
| `{d.trabajador.nombre_completo}` | Nombres y apellidos |
| `{d.trabajador.nombres}` | Solo nombres |
| `{d.trabajador.primer_apellido}` | Apellido paterno |
| `{d.trabajador.segundo_apellido}` | Apellido materno |
| `{d.trabajador.rut_formateado}` | RUT con puntos y guion (12.345.678-9) |
| `{d.trabajador.tratamiento}` | "don" / "doña" según género |
| `{d.trabajador.sr_sra}` | "SR." / "SRA." según género |
| `{d.trabajador.trabajador_a}` | "TRABAJADOR" / "TRABAJADORA" |
| `{d.trabajador.del_dela}` | "DEL" / "DE LA" según género |
| `{d.contrato.fecha_inicio:formatD(LL)}` | Fecha de inicio (30 de abril de 2026) |
| `{d.contrato.fecha_termino_texto}` | Fecha de término o "Indefinido" |
| `{d.contrato.jornada}` | Horas de jornada |
| `{d.contrato.sueldo_base:formatC(0)}` | Sueldo base como moneda sin decimales |
| `{d.documento.ciudad}` | Ciudad de emisión |
| `{d.documento.fecha_emision:formatD(LL)}` | Fecha de emisión en texto |
| `{d.institucion.nombre}` | Nombre de la institución |
| `{d.institucion.region}` | Región |
| `{d.firmante.nombre}` | Nombre del firmante (editable en la vista) |
| `{d.firmante.cargo}` | Cargo del firmante (editable) |
| `{d.firmante.rut}` | RUT del firmante (editable) |

### Solo en la Notificación de Fin de Contrato

| Marcador | Reemplaza por |
|---|---|
| `{d.notificacion.numero}` | Número de la notificación |
| `{d.notificacion.fin_contrato:formatD(LL)}` | Fecha de término comunicada |
| `{d.notificacion.fin_contrato:formatD('MMMM [de] YYYY')}` | Mes/año del término (cotizaciones) |
| `{d.notificacion.articulo}` | Artículo completo, ej. "159, N°4" o "161" (desde el catálogo de causales) |
| `{d.notificacion.causal}` | Texto de la causal (desde el catálogo `CAUSALES` en `lib/plantillas.ts`) |
| `{d.notificacion.redactor_iniciales}` | Iniciales del redactor (minúscula) |

### Solo en el Finiquito (`finiquito.docx`)

Esta plantilla usa su propio conjunto de datos (ver `lib/finiquito.ts`), no `DatosDocumento`.
El módulo **Finiquito** (`/dashboard/finiquito`) calcula el feriado proporcional y rellena estos
marcadores:

| Marcador | Reemplaza por |
|---|---|
| `{d.programa.proyecto}` | Párrafo del proyecto/convenio (cabecera, según el programa) |
| `{d.trabajador.nombre_completo_upper}` | Nombre del trabajador en mayúsculas |
| `{d.trabajador.tratamiento_cap}` | "Don" / "Doña" |
| `{d.trabajador.del_dela}` / `{d.trabajador.genero_a}` | "DEL"/"DE LA" y sufijo "A" para el título |
| `{d.trabajador.rut_miles}` - `{d.trabajador.dv}` | RUT y dígito verificador |
| `{d.contrato.fecha_inicio:formatD(LL)}` / `{d.contrato.fecha_termino:formatD(LL)}` | Período |
| `{d.finiquito.terminos}` / `{d.finiquito.articulo}` | Causal de término y artículo |
| `{d.finiquito.fp_texto}` | Días de feriado proporcional (ej. "5,42") |
| `{d.finiquito.total_texto}` | Monto a pagar con puntos de miles (ej. "108.400") |
| `{d.finiquito.total_palabras}` | Monto en palabras (ej. "CIENTO OCHO MIL ... PESOS") |
| `{d.firmante.nombre}` / `{d.firmante.nombre_corto}` / `{d.firmante.cargo}` / `{d.firmante.rut}` | Firmante |

> `finiquito.docx` se generó por código (a partir del esqueleto de `notificacion-fin-contrato.docx`)
> para garantizar que cada marcador quede en un único *run*. Puedes abrirlo y editarlo en Word;
> respeta los marcadores `{d....}` sin partirlos entre distintos formatos.

### Solo en la Recepción de Documentos (`recepcion-documentos.docx`)

El módulo **Recepción** (`/dashboard/recepcion`) usa su propio conjunto de datos
(ver `lib/recepcion.ts`). La tabla de detalle **se repite** por cada documento recibido
usando la sintaxis de lista de Carbone `{d.detalles[i].campo}` (con una fila «límite»
`{d.detalles[i+1].campo}` que Carbone consume al renderizar):

| Marcador | Reemplaza por |
|---|---|
| `{d.documento.tipos}` | Tipos de documento seleccionados |
| `{d.documento.fecha_recepcion:formatD(LL)}` | Fecha de recepción en texto |
| `{d.documento.descripcion}` | Cantidad / descripción general |
| `{d.detalles[i].fecha_emision}` | Fecha de emisión de cada fila (ya en DD-MM-YYYY) |
| `{d.detalles[i].programa}` | Programa de cada fila |
| `{d.detalles[i].rut}` / `{d.detalles[i].dv}` | RUT y dígito verificador |
| `{d.detalles[i].nombre}` / `{d.detalles[i].apellido_p}` / `{d.detalles[i].apellido_m}` | Nombre y apellidos |
| `{d.detalles[i].genero}` | Género (M/F/S/R) |
| `{d.entrega}` / `{d.recibe}` | Quien entrega / quien recibe |

> Se generó por código con `node scripts/build-recepcion-docx.cjs` (usa el logo de
> `public/logoconaf.png`). Para repetir filas en una tabla, Carbone necesita **dos** filas
> en la plantilla: la de datos con `[i]` y una de límite con `[i+1]`.

### Solo en el Contrato de Trabajo (`contrato-trabajo.docx`)

El módulo **Contratos** (`/dashboard/contratos`) usa su propio conjunto de datos
(ver `lib/contrato.ts`). Muchos campos personales no están en la base y se completan
en el formulario. Los textos que dependen del género (el/la, trabajador/a) se resuelven
en el código y llegan como `{d.g.*}`. La cláusula de bonos (NOVENO) es **condicional**:
se muestra solo si hay bonos, usando los formateadores `:ifEQ(true):showBegin` … `:showEnd`
de Carbone sobre `{d.bonos.mostrar}`.

| Marcador | Reemplaza por |
|---|---|
| `{d.programa.proyecto}` / `{d.programa.subtitulo}` / `{d.programa.nombre}` | Proyecto, subtítulo y nombre del programa |
| `{d.trabajador.*}` | trato, nombre/apellidos, RUT/DV, nacionalidad, estado_civil, lugar_nac, fecha_nac, domicilio, comuna |
| `{d.g.*}` | Textos por género: el_la, El_La, el_trabajador, El_trabajador, del_trabajador, al_trabajador |
| `{d.contrato.*}` | inicio, termino, labores, lugar_trabajo, dependencia_dir, sueldo_texto, sueldo_palabras, prevision, salud |
| `{d.bonos.*}` | mostrar, numeral_ejemplares, mov_texto/mov_palabras, col_texto/col_palabras |
| `{d.director.*}` / `{d.institucion.*}` | Firmante (director) e institución |

> Se generó con `node scripts/build-contrato-docx.cjs` (usa el logo de `public/logoconaf.png`).

## Formateadores útiles de Carbone

- Fechas localizadas: `:formatD(LL)` → "30 de abril de 2026" (usa `lang: 'es-cl'`).
- **IMPORTANTE**: si usas un patrón propio con espacios, **enciérralo en comillas simples**:
  `:formatD('MMMM [de] YYYY')` → "abril de 2026". Sin comillas, Carbone borra los espacios
  (`30deabrilde2026`). Por eso preferimos el token `LL`.
- Moneda: `:formatC(0)` — pesos chilenos sin decimales (con `lang: 'es-cl'`).
- Mayúsculas: `:ucase` — por ejemplo `{d.trabajador.nombre_completo:ucase}`.

## Ejemplo de contenido para "certificado-antiguedad.docx"

```
{d.institucion.nombre}
{d.institucion.region}
{d.institucion.seccion}

CERTIFICADO DE ANTIGÜEDAD

La Sección Recursos Humanos certifica que {d.trabajador.tratamiento}
{d.trabajador.nombre_completo}, RUT {d.trabajador.rut_formateado}, presta
servicios en esta Corporación desde el
{d.contrato.fecha_inicio:formatD(DD [de] MMMM [de] YYYY)}, con una jornada de
{d.contrato.jornada} horas semanales.

Se extiende el presente certificado a petición del interesado.

{d.documento.ciudad}, {d.documento.fecha_emision:formatD(DD [de] MMMM [de] YYYY)}.
```

## Requisito para el PDF

La conversión `.docx → .pdf` la hace **LibreOffice** (Carbone lo invoca por debajo).
Debe estar instalado en el servidor donde corre la app:

- Windows: instala LibreOffice desde https://es.libreoffice.org/
- Linux (servidor): `sudo apt install libreoffice`

Si LibreOffice no está instalado, el botón **"Descargar Word"** funciona igual;
solo falla la conversión a PDF.
