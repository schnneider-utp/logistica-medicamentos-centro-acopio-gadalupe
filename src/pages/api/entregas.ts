import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const GET: APIRoute = async () => {
  try {
    const entregas = await prisma.entregas.findMany({
      include: {
        beneficiario: { select: { nombre: true, celular: true, direccion: true } },
        detalles: {
          include: {
            medicamento: {
              select: { nombre_generico: true, nombre_comercial: true, concentracion: true },
            },
          },
        },
      },
      orderBy: { fecha_entrega: 'desc' },
    });

    return new Response(JSON.stringify(entregas), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener entregas' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();
    const { beneficiario, medicamentos, url_formula_medica } = data;

    const result = await prisma.$transaction(async (tx) => {
      let beneficiarioRecord = await tx.beneficiarios.findFirst({
        where: { nombre: { equals: beneficiario.nombre, mode: 'insensitive' } },
      });

      if (!beneficiarioRecord) {
        beneficiarioRecord = await tx.beneficiarios.create({
          data: {
            nombre: beneficiario.nombre,
            celular: beneficiario.celular || null,
            direccion: beneficiario.direccion || null,
          },
        });
      }

      const entrega = await tx.entregas.create({
        data: {
          beneficiario_id: beneficiarioRecord.id,
          url_formula_medica: url_formula_medica || null,
        },
      });

      for (const med of medicamentos) {
        if (med.cantidad > 0) {
          await tx.detalle_entrega.create({
            data: {
              entrega_id: entrega.id,
              medicamento_id: med.id,
              cantidad_entregada: med.cantidad,
            },
          });

          await tx.medicamentos_inventario.update({
            where: { id: med.id },
            data: { cantidad_disponible: { decrement: med.cantidad } },
          });
        }
      }

      return entrega;
    });

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear entrega' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
