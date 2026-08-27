import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';
import { Prisma } from '@prisma/client';

export const GET: APIRoute = async ({ url }) => {
  try {
    const tipo = url.searchParams.get('tipo');

    if (tipo === 'donantes') {
      const data = await prisma.$queryRaw<{
        id: number; nombre: string; celular: string | null; correo: string | null;
        donaciones: bigint; total_tabletas: bigint; fecha_ultima: Date | null;
      }[]>`
        SELECT
          d.id, d.nombre, d.celular, d.correo,
          COUNT(mi.id) AS donaciones,
          COALESCE(SUM(mi.cantidad_disponible), 0) AS total_tabletas,
          MAX(mi.creado_en) AS fecha_ultima
        FROM donantes d
        LEFT JOIN medicamentos_inventario mi ON mi.donante_id = d.id
        GROUP BY d.id, d.nombre, d.celular, d.correo
        ORDER BY d.nombre ASC
      `;

      const rows = data.map(d => ({
        ID: d.id,
        Nombre: d.nombre,
        Celular: d.celular || '',
        Correo: d.correo || '',
        'Total Donaciones': Number(d.donaciones),
        'Total Tabletas': Number(d.total_tabletas),
        'Ultima Donacion': d.fecha_ultima ? new Date(d.fecha_ultima).toISOString().split('T')[0] : '',
      }));

      return new Response(JSON.stringify({ rows, filename: 'donantes.xlsx' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (tipo === 'beneficiarios') {
      const beneficiariosRaw = await prisma.beneficiarios.findMany({
        include: { _count: { select: { entregas: true } } },
        orderBy: { nombre: 'asc' },
      });

      const ids = beneficiariosRaw.map(b => b.id);
      const ultimasEntregas = ids.length > 0
        ? await prisma.$queryRaw<{ beneficiario_id: number; fecha_entrega: Date; nombre_generico: string | null; concentracion: string | null }[]>`
          SELECT e.beneficiario_id, e.fecha_entrega, mi.nombre_generico, mi.concentracion
          FROM entregas e
          INNER JOIN detalle_entrega de ON de.entrega_id = e.id
          INNER JOIN medicamentos_inventario mi ON mi.id = de.medicamento_id
          WHERE e.id IN (
            SELECT e2.id FROM entregas e2
            WHERE e2.beneficiario_id = ANY(${ids})
            ORDER BY e2.fecha_entrega DESC
            LIMIT 1 OFFSET 0
          )
        `
        : [];

      const entregaMap = new Map<number, { fecha: Date; medicamento: string }>();
      for (const row of ultimasEntregas) {
        if (!entregaMap.has(row.beneficiario_id)) {
          const med = [row.nombre_generico, row.concentracion].filter(Boolean).join(' ');
          entregaMap.set(row.beneficiario_id, { fecha: row.fecha_entrega, medicamento: med });
        }
      }

      const rows = beneficiariosRaw.map(b => ({
        ID: b.id,
        Nombre: b.nombre,
        Celular: b.celular || '',
        Direccion: b.direccion || '',
        'Total Entregas': b._count.entregas,
        'Ultimo Medicamento': entregaMap.get(b.id)?.medicamento || '',
        'Fecha Ultima Entrega': entregaMap.get(b.id)?.fecha.toISOString().split('T')[0] || '',
      }));

      return new Response(JSON.stringify({ rows, filename: 'beneficiarios.xlsx' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (tipo === 'inventario') {
      const data = await prisma.medicamentos_inventario.findMany({
        include: { donante: { select: { nombre: true } } },
        orderBy: { creado_en: 'desc' },
      });

      const ahora = new Date();
      const rows = data.map(m => {
        const diffDias = Math.ceil((new Date(m.fecha_vencimiento).getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));
        let estado = 'Vigente';
        if (diffDias < 0) estado = 'Vencido';
        else if (diffDias <= 30) estado = 'Por Vencer';

        return {
          ID: m.id,
          'Nombre Generico': m.nombre_generico,
          'Nombre Comercial': m.nombre_comercial || '',
          Concentracion: m.concentracion || '',
          Tipo: m.tipo_cantidad || '',
          'Cantidad Disponible': m.cantidad_disponible,
          'Fecha Vencimiento': new Date(m.fecha_vencimiento).toISOString().split('T')[0],
          Donante: m.donante?.nombre || '',
          Estado: estado,
          'Fecha Creacion': new Date(m.creado_en).toISOString().split('T')[0],
        };
      });

      return new Response(JSON.stringify({ rows, filename: 'inventario.xlsx' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (tipo === 'historial') {
      const [rawDonaciones, rawEntregas] = await Promise.all([
        prisma.medicamentos_inventario.findMany({
          include: { donante: { select: { nombre: true } } },
          orderBy: { creado_en: 'desc' },
        }),
        prisma.entregas.findMany({
          include: {
            beneficiario: { select: { nombre: true } },
            detalles: {
              include: {
                medicamento: { select: { nombre_generico: true, concentracion: true, tipo_cantidad: true } },
              },
            },
          },
          orderBy: { fecha_entrega: 'desc' },
        }),
      ]);

      interface HistorialRow {
        'Tipo Evento': string;
        Fecha: string;
        Persona: string;
        Medicamento: string;
        Cantidad: number;
        Estado: string;
      }

      const rows: HistorialRow[] = [];

      for (const d of rawDonaciones) {
        const diffDias = Math.ceil((new Date(d.fecha_vencimiento).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        let estado = 'Vigente';
        if (diffDias < 0) estado = 'Vencido';
        else if (diffDias <= 30) estado = 'Por Vencer';

        rows.push({
          'Tipo Evento': 'Donacion',
          Fecha: new Date(d.creado_en).toISOString().split('T')[0],
          Persona: d.donante?.nombre || 'Desconocido',
          Medicamento: `${d.nombre_generico}${d.concentracion ? ' ' + d.concentracion : ''}${d.tipo_cantidad ? ' (' + d.tipo_cantidad + ')' : ''}`,
          Cantidad: d.cantidad_disponible,
          Estado: estado,
        });
      }

      for (const e of rawEntregas) {
        for (const det of e.detalles) {
          rows.push({
            'Tipo Evento': 'Entrega',
            Fecha: new Date(e.fecha_entrega).toISOString().split('T')[0],
            Persona: e.beneficiario.nombre,
            Medicamento: `${det.medicamento.nombre_generico}${det.medicamento.concentracion ? ' ' + det.medicamento.concentracion : ''}${det.medicamento.tipo_cantidad ? ' (' + det.medicamento.tipo_cantidad + ')' : ''}`,
            Cantidad: det.cantidad_entregada,
            Estado: '-',
          });
        }
      }

      rows.sort((a, b) => new Date(b.Fecha).getTime() - new Date(a.Fecha).getTime());

      return new Response(JSON.stringify({ rows, filename: 'historial.xlsx' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Tipo no valido. Use: donantes, beneficiarios, inventario, historial' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al exportar datos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
