import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const GET: APIRoute = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';

    const beneficiarios = await prisma.beneficiarios.findMany({
      where: search ? {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { direccion: { contains: search, mode: 'insensitive' } },
        ],
      } : undefined,
      include: {
        entregas: {
          orderBy: { fecha_entrega: 'desc' },
          take: 1,
          include: {
            detalles: {
              include: { medicamento: { select: { nombre_generico: true, concentracion: true } } },
            },
          },
        },
        _count: { select: { entregas: true } },
      },
      orderBy: { nombre: 'asc' },
    });

    const resultado = beneficiarios.map(b => {
      const ultimaEntrega = b.entregas[0] || null;
      let ultimoMedicamento = '';
      if (ultimaEntrega && ultimaEntrega.detalles.length > 0) {
        const det = ultimaEntrega.detalles[0].medicamento;
        ultimoMedicamento = `${det.nombre_generico} ${det.concentracion || ''}`.trim();
      }

      return {
        id: b.id,
        nombre: b.nombre,
        celular: b.celular,
        direccion: b.direccion,
        entregas: b._count.entregas,
        ultimoMedicamento,
        fechaUltima: ultimaEntrega?.fecha_entrega?.toISOString() || null,
      };
    });

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener beneficiarios' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    const beneficiario = await prisma.beneficiarios.create({
      data: {
        nombre: data.nombre,
        celular: data.celular || null,
        direccion: data.direccion || null,
      },
    });

    return new Response(JSON.stringify(beneficiario), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear beneficiario' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
