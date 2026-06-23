import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { mensaje } = await req.json();
    const texto = String(mensaje).toLowerCase().trim();

    // Palabras clave de limpieza para aislar el nombre del trabajador
    const limpiarComando = (str: string) => {
      return str
        .replace('cuantos contratos tiene', '')
        .replace('cuantos contratos posee', '')
        .replace('datos de', '')
        .replace('busca a', '')
        .replace('quien es', '')
        .trim();
    };

    // ----------------------------------------------------------------------
    // CASO A: CONSULTA DE CANTIDAD DE CONTRATOS ("cuantos contratos tiene...")
    // ----------------------------------------------------------------------
    if (texto.includes('contratos') && (texto.includes('cuantos') || texto.includes('tiene') || texto.includes('posee'))) {
      const nombreBuscar = limpiarComando(texto);
      const palabras = nombreBuscar.split(/\s+/).filter(p => p.length > 0);

      if (palabras.length === 0) {
        return NextResponse.json({ respuesta: 'Por favor, dime el nombre del funcionario para consultar sus contratos.' });
      }

      // Buscamos primero al trabajador
      let queryTrabajador = supabase.from('trabajadores').select('rut, nombres, primer_apellido, segundo_apellido');
      palabras.forEach((p) => {
        queryTrabajador = queryTrabajador.or(`nombres.ilike.%${p}%,primer_apellido.ilike.%${p}%,segundo_apellido.ilike.%${p}%`);
      });

      const { data: trabajadores, error: errT } = await queryTrabajador.limit(1);

      if (errT) throw errT;
      if (!trabajadores || trabajadores.length === 0) {
        return NextResponse.json({ respuesta: `No encontré a ningún funcionario que coincida con "${nombreBuscar}" para revisar sus contratos.` });
      }

      const t = trabajadores[0];

      // Hacemos el conteo real en la tabla 'contratos' usando el RUT encontrado
      const { count, error: errC } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('trabajador_rut', t.rut);

      if (errC) throw errC;

      const maternoText = t.segundo_apellido ? ` ${t.segundo_apellido}` : '';
      const totalContratos = count || 0;
      const pluralText = totalContratos === 1 ? 'contrato registrado' : 'contratos registrados';

      return NextResponse.json({
        respuesta: `📊 **Análisis Contractual:**\n\nEl funcionario **${t.nombres} ${t.primer_apellido}${maternoText}** (RUT: ${t.rut}) cuenta actualmente con **${totalContratos}** ${pluralText} en el sistema **siscon RRHH**.`
      });
    }

    // ----------------------------------------------------------------------
    // CASO B: CONSULTA DE DATOS BÁSICOS ("datos de...") [Mantenemos tu lógica previa]
    // ----------------------------------------------------------------------
    if (texto.includes('datos de') || texto.includes('busca a') || texto.includes('quien es')) {
      const nombreBuscar = limpiarComando(texto);
      const palabras = nombreBuscar.split(/\s+/).filter(p => p.length > 0);

      if (palabras.length === 0) {
        return NextResponse.json({ respuesta: 'Dime el nombre de qué funcionario necesitas buscar.' });
      }

      let query = supabase.from('trabajadores').select('*');
      palabras.forEach((palabra) => {
        query = query.or(`nombres.ilike.%${palabra}%,primer_apellido.ilike.%${palabra}%,segundo_apellido.ilike.%${palabra}%`);
      });

      const { data: trabajadores, error } = await query.limit(5);
      if (error) throw error;

      if (!trabajadores || trabajadores.length === 0) {
        return NextResponse.json({ respuesta: `No encontré ningún funcionario en la nómina que coincida con "${nombreBuscar}".` });
      }

      let respuestaText = `🔍 **Resultado de la búsqueda analítica:**\n`;
      trabajadores.forEach((t) => {
        const maternoText = t.segundo_apellido ? ` ${t.segundo_apellido}` : '';
        respuestaText += `\n• **Nombre:** ${t.nombres} ${t.primer_apellido}${maternoText}\n  **RUT:** ${t.rut}-${t.dv}\n`;
      });

      return NextResponse.json({ respuesta: respuestaText });
    }

    // ----------------------------------------------------------------------
    // RESPUESTA POR DEFECTO / BIENVENIDA
    // ----------------------------------------------------------------------
    return NextResponse.json({ 
      respuesta: 'Hola. Soy tu Asistente Analítico. Puedo ayudarte a consultar la información del personal en Supabase. Prueba preguntándome: "datos de Julia Alcon" o "cuantos contratos tiene julia alcon".' 
    });

  } catch (error: any) {
    return NextResponse.json({ respuesta: `Error al procesar la consulta: ${error.message}` }, { status: 500 });
  }
}