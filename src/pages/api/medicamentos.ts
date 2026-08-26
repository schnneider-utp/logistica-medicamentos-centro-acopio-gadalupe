import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const GET: APIRoute = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';
    const tipo = url.searchParams.get('tipo') || '';

    const medicamentos = await prisma.medicamentos_inventario.findMany({
      where: {
        ...(search ? {
          OR: [
            { nombre_generico: { contains: search, mode: 'insensitive' } },
            { nombre_comercial: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
        ...(tipo ? { tipo_cantidad: tipo } : {}),
      },
      include: { donante: { select: { nombre: true } } },
      orderBy: { creado_en: 'desc' },
    });

    const resultado = medicamentos.map(m => ({
      id: m.id,
      generico: m.nombre_generico,
      comercial: m.nombre_comercial,
      concentracion: m.concentracion,
      tipo: m.tipo_cantidad,
      cantidad: m.cantidad_disponible,
      vencimiento: m.fecha_vencimiento.toISOString(),
      donante: m.donante?.nombre || 'Sin donante',
      donanteId: m.donante_id,
    }));

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener medicamentos' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    let donanteId = data.donante_id || null;

    if (data.donante_nombre && !donanteId) {
      let donante = await prisma.donantes.findFirst({
        where: { nombre: { equals: data.donante_nombre, mode: 'insensitive' } },
      });

      if (!donante) {
        donante = await prisma.donantes.create({
          data: { nombre: data.donante_nombre },
        });
      }
      donanteId = donante.id;
    }

    const medicamento = await prisma.medicamentos_inventario.create({
      data: {
        nombre_generico: data.nombre_generico,
        nombre_comercial: data.nombre_comercial || null,
        concentracion: data.concentracion || null,
        tipo_cantidad: data.tipo_cantidad || null,
        cantidad_disponible: parseInt(data.cantidad),
        fecha_vencimiento: new Date(data.fecha_vencimiento),
        donante_id: donanteId,
        url_bucket_comprobante: data.url_bucket_comprobante || null,
      },
    });

    return new Response(JSON.stringify(medicamento), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear medicamento' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
