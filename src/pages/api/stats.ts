import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const GET: APIRoute = async () => {
  try {
    const [
      totalMedicamentos,
      totalEntregas,
      totalBeneficiarios,
      totalDonantes,
      porVencer,
    ] = await Promise.all([
      prisma.medicamentos_inventario.aggregate({
        _sum: { cantidad_disponible: true },
      }),
      prisma.entregas.count(),
      prisma.beneficiarios.count(),
      prisma.donantes.count(),
      prisma.medicamentos_inventario.count({
        where: {
          fecha_vencimiento: {
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
    ]);

    const [
      ultimosMedicamentos,
      ultimasEntregas,
    ] = await Promise.all([
      prisma.medicamentos_inventario.findMany({
        take: 5,
        orderBy: { creado_en: 'desc' },
        include: { donante: { select: { nombre: true } } },
      }),
      prisma.entregas.findMany({
        take: 5,
        orderBy: { fecha_entrega: 'desc' },
        include: {
          beneficiario: { select: { nombre: true } },
          detalles: {
            include: {
              medicamento: { select: { nombre_generico: true, concentracion: true } },
            },
          },
        },
      }),
    ]);

    const actividad = [
      ...ultimosMedicamentos.map(m => ({
        tipo: 'entry' as const,
        accion: 'Ingreso de lote',
        detalle: `${m.nombre_generico} ${m.concentracion || ''} - ${m.cantidad_disponible} ${m.tipo_cantidad || 'unidades'}`,
        fecha: m.creado_en.toISOString(),
      })),
      ...ultimasEntregas.map(e => ({
        tipo: 'exit' as const,
        accion: 'Entrega realizada',
        detalle: e.detalles.length > 0
          ? `${e.detalles[0].medicamento.nombre_generico} a ${e.beneficiario.nombre}`
          : `Entrega a ${e.beneficiario.nombre}`,
        fecha: e.fecha_entrega.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5);

    return new Response(JSON.stringify({
      stats: [
        { label: 'Medicamentos Recibidos', value: totalMedicamentos._sum.cantidad_disponible || 0, icon: 'pill', color: 'green' },
        { label: 'Entregas Realizadas', value: totalEntregas, icon: 'upload', color: 'blue' },
        { label: 'Beneficiarios Activos', value: totalBeneficiarios, icon: 'users', color: 'green' },
        { label: 'Donantes Registrados', value: totalDonantes, icon: 'handshake', color: 'blue' },
      ],
      stockDisponible: totalMedicamentos._sum.cantidad_disponible || 0,
      porVencer,
      actividad,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener estadísticas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
