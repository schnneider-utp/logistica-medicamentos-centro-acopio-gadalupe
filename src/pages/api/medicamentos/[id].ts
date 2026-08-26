import type { APIRoute } from 'astro';
import prisma from '../../../lib/prisma';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id || '');
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
    }

    const data = await request.json();

    const medicamento = await prisma.medicamentos_inventario.update({
      where: { id },
      data: {
        nombre_generico: data.nombre_generico,
        nombre_comercial: data.nombre_comercial || null,
        concentracion: data.concentracion || null,
        tipo_cantidad: data.tipo_cantidad || null,
        cantidad_disponible: parseInt(data.cantidad_disponible),
        fecha_vencimiento: new Date(data.fecha_vencimiento),
      },
    });

    return new Response(JSON.stringify(medicamento), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al actualizar medicamento' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '');
    if (isNaN(id)) {
      return new Response(JSON.stringify({ error: 'ID inválido' }), { status: 400 });
    }

    await prisma.medicamentos_inventario.delete({
      where: { id },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al eliminar medicamento' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
