import type { APIRoute } from 'astro';
import prisma from '../../lib/prisma';

export const GET: APIRoute = async ({ url }) => {
  try {
    const search = url.searchParams.get('search') || '';

    const donantes = await prisma.donantes.findMany({
      where: search ? {
        OR: [
          { nombre: { contains: search, mode: 'insensitive' } },
          { correo: { contains: search, mode: 'insensitive' } },
        ],
      } : undefined,
      include: {
        _count: { select: { medicamentos: true } },
        medicamentos: {
          select: { cantidad_disponible: true, creado_en: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    const resultado = donantes.map(d => {
      const totalTabletas = d.medicamentos.reduce((sum, m) => sum + m.cantidad_disponible, 0);
      const tiposMedicamentos = new Set(d.medicamentos.map(() => d.id)).size;
      const fechaUltima = d.medicamentos.length > 0
        ? d.medicamentos.reduce((latest, m) => m.creado_en > latest ? m.creado_en : latest, d.medicamentos[0].creado_en)
        : null;

      return {
        id: d.id,
        nombre: d.nombre,
        celular: d.celular,
        correo: d.correo,
        donaciones: d._count.medicamentos,
        tiposMedicamentos: d._count.medicamentos,
        fechaUltima: fechaUltima?.toISOString() || null,
        totalTabletas,
      };
    });

    return new Response(JSON.stringify(resultado), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al obtener donantes' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const data = await request.json();

    const donante = await prisma.donantes.create({
      data: {
        nombre: data.nombre,
        celular: data.celular || null,
        correo: data.correo || null,
      },
    });

    return new Response(JSON.stringify(donante), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error al crear donante' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
