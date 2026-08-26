export function calcularEstado(fechaVencimiento: Date): 'vigente' | 'por-vencer' | 'vencido' {
  const ahora = new Date();
  const vencimiento = new Date(fechaVencimiento);
  const diffDias = Math.ceil((vencimiento.getTime() - ahora.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'vencido';
  if (diffDias <= 30) return 'por-vencer';
  return 'vigente';
}

export function getEstadoBadge(estado: string) {
  switch (estado) {
    case 'vigente': return { label: 'Vigente', class: 'badge-success' };
    case 'por-vencer': return { label: 'Por Vencer', class: 'badge-warning' };
    case 'vencido': return { label: 'Vencido', class: 'badge-danger' };
    default: return { label: 'Desconocido', class: 'badge-info' };
  }
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('es-CO');
}

export function tiempoRelativo(date: Date | string): string {
  const ahora = new Date();
  const fecha = new Date(date);
  const diffMs = ahora.getTime() - fecha.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMs / 3600000);
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Ahora mismo';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHoras < 24) return `Hace ${diffHoras} hora${diffHoras > 1 ? 's' : ''}`;
  if (diffDias < 7) return `Hace ${diffDias} día${diffDias > 1 ? 's' : ''}`;
  return formatDate(date);
}
