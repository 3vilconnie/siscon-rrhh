// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { mensaje } = await req.json();
    const texto = String(mensaje).toLowerCase().trim();

    // UX Inteligente: Palabras de descarte más exhaustivas para aislar nombres
    const limpiarComando = (str: string) => {
      return str
        .replace(/(cuantos|cuántos|posee|tiene|registra|contratos|anexos|el funcionario|la funcionaria|buscar|busca a|encuentra a|quien es|quién es|datos de|ficha de|por favor)/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // 1. EVALUAR INTENCIÓN: Cantidad de contratos (Entiende: "Dime los contratos de Julia", "julia alcon cuantos contratos tiene?")
    const quiereContratos = /(contrato|anexo|cantidad|cuanto|tiene)/g.test(texto);
    const quiereDatos = /(datos|quien|busca|ficha|perfil)/g.test(texto);

    if (quiereContratos || quiereDatos) {
      const nombreBuscar = limpiarComando(texto);
      const palabras = nombreBuscar.split(/\s+/).filter(p => p.length > 0);

      if (palabras.length === 0) {
        return NextResponse.json({ respuesta: 'Por favor, indícame el nombre o apellido del funcionario que deseas consultar.' });
      }

      // Consulta flexible con OR en Supabase
      let queryTrabajador = supabase.from('trabajadores').select('rut, dv, nombres, primer_apellido, segundo_apellido');
      palabras.forEach((p) => {
        queryTrabajador = queryTrabajador.or(`nombres.ilike.%${p}%,primer_apellido.ilike.%${p}%,segundo_apellido.ilike.%${p}%`);
      });

      const { data: trabajadores, error: errT } = await queryTrabajador.limit(3);

      if (errT) throw errT;
      if (!trabajadores || trabajadores.length === 0) {
        return NextResponse.json({ respuesta: `No encontré ningún funcionario en los registros que coincida con la búsqueda de: **${nombreBuscar}**.` });
      }

      // Si encuentra múltiples coincidencias por ambigüedad (ej: buscar solo "Julia")
      if (trabajadores.length > 1) {
        let respuestaMulti = `Encontré ${trabajadores.length} funcionarios que coinciden. ¿A quién te refieres?\n`;
        trabajadores.forEach(t => {
          respuestaMulti += `\n• **${t.nombres} ${t.primer_apellido}** (RUT: ${t.rut}-${t.dv})`;
        });
        return NextResponse.json({ respuesta: respuestaMulti });
      }

      const t = trabajadores[0];
      const { count, error: errC } = await supabase
        .from('contratos')
        .select('*', { count: 'exact', head: true })
        .eq('trabajador_rut', t.rut);

      if (errC) throw errC;

      const maternoText = t.segundo_apellido ? ` ${t.segundo_apellido}` : '';
      
      if (quiereContratos) {
        return NextResponse.json({
          respuesta: `📄 **Análisis Contractual**\n\n👤 **Funcionario:** ${t.nombres} ${t.primer_apellido}${maternoText}\n🪪 **RUT:** ${t.rut}-${t.dv}\n📋 **Contratos Registrados:** ${count || 0} en total.`
        });
      } else {
        return NextResponse.json({
          respuesta: `🔍 **Ficha de Identidad Encontrada**\n\n👤 **Nombre:** ${t.nombres} ${t.primer_apellido}${maternoText}\n🪪 **RUT:** ${t.rut}-${t.dv}\n\n*Tip: Puedes consultar sus contratos escribiendo: "cuántos contratos tiene ${t.nombres}".*`
        });
      }
    }

    // 2. EVALUAR INTENCIÓN: Sueldos altos o reportería básica
    if (texto.includes('sueldo') || texto.includes('gana') || texto.includes('remuneracion')) {
      const { data: contratos } = await supabase
        .from('contratos')
        .select('trabajador_rut, sueldo_base')
        .order('sueldo_base', { ascending: false })
        .limit(3);

      if (contratos && contratos.length > 0) {
        let respuestaSueldos = `📊 **Reporte de Remuneraciones Altas**\n\nAquí tienes los montos base brutos más altos registrados en el sistema:\n`;
        contratos.forEach((c, idx) => {
          respuestaSueldos += `\n${idx + 1}. RUT Funcionario: **${c.trabajador_rut}** — Mto: **$${parseFloat(c.sueldo_base).toLocaleString('es-CL')}**`;
        });
        return NextResponse.json({ respuesta: respuestaSueldos });
      }
    }

    return NextResponse.json({ 
      respuesta: 'No logré comprender del todo la consulta. Prueba con expresiones como: \n\n• *"¿Cuántos contratos tiene Julia?"*\n• *"Ficha de datos de Alcon"*' 
    });

  } catch (error: any) {
    return NextResponse.json({ respuesta: `Error interno de procesamiento: ${error.message}` }, { status: 500 });
  }
}